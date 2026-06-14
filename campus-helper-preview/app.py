import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

from flask import Flask, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "campus_helper.db"
HASH_METHOD = "pbkdf2:sha256"


app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["SECRET_KEY"] = os.environ.get("CAMPUS_HELPER_SECRET", "campus-helper-dev-secret")


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_: Any) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          nickname TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          creator_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          building TEXT NOT NULL,
          same_building INTEGER NOT NULL DEFAULT 0,
          is_anonymous INTEGER NOT NULL DEFAULT 0,
          price REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'open',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (creator_id) REFERENCES users(id)
        );
        """
    )
    db.commit()
    seed_demo_data()


def seed_demo_data() -> None:
    db = get_db()
    existing = db.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    if existing:
        return

    demo_password = generate_password_hash("123456", method=HASH_METHOD)
    db.execute(
        "INSERT INTO users (phone, password_hash, nickname) VALUES (?, ?, ?)",
        ("13800138000", demo_password, "校园帮演示号"),
    )
    user_id = db.execute("SELECT id FROM users WHERE phone = ?", ("13800138000",)).fetchone()["id"]
    demo_orders = [
        (
            user_id,
            "代取快递",
            "北 7 楼快递柜取件，送到 431 寝室门口",
            "匿名发布，菜鸟柜 3-12 号门，包裹较轻。支持到门口拍照，晚上 9 点前都可以。",
            "北区 7 号楼",
            1,
            1,
            6.0,
            "open",
        ),
        (
            user_id,
            "外卖捎上楼",
            "东区 2 号楼楼下奶茶顺手带到 608",
            "骑手预计 6 分钟到，楼下拿到后直接带上来即可，备注少冰少糖。",
            "东区 2 号楼",
            1,
            0,
            3.5,
            "open",
        ),
        (
            user_id,
            "复习资料",
            "高数 A 期末笔记电子版 + 打印件",
            "付款成功后已自动屏蔽，本单用于展示锁单后的视觉状态。",
            "教学区自提",
            0,
            0,
            12.0,
            "locked",
        ),
    ]
    db.executemany(
        """
        INSERT INTO orders (
          creator_id, type, title, description, building, same_building,
          is_anonymous, price, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        demo_orders,
    )
    db.commit()


def current_user() -> Optional[sqlite3.Row]:
    user_id = session.get("user_id")
    if not user_id:
        return None
    return get_db().execute(
        "SELECT id, phone, nickname, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()


def require_auth():
    user = current_user()
    if user is None:
        return None, (jsonify({"error": "未登录"}), 401)
    return user, None


def serialize_order(row: sqlite3.Row, viewer_id: Optional[int] = None) -> dict[str, Any]:
    nickname = row["nickname"]
    if row["is_anonymous"] and viewer_id != row["creator_id"]:
        nickname = "匿名用户"
    return {
        "id": row["id"],
        "type": row["type"],
        "title": row["title"],
        "description": row["description"],
        "building": row["building"],
        "sameBuilding": bool(row["same_building"]),
        "isAnonymous": bool(row["is_anonymous"]),
        "price": row["price"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "creator": nickname,
        "mine": viewer_id == row["creator_id"],
    }


@app.before_request
def setup_db() -> None:
    init_db()


@app.get("/")
def index():
    if current_user():
        return redirect(url_for("app_page"))
    return redirect(url_for("login_page"))


@app.get("/login")
def login_page():
    if current_user():
        return redirect(url_for("app_page"))
    return render_template("login.html")


@app.get("/app")
def app_page():
    user = current_user()
    if not user:
        return redirect(url_for("login_page"))
    return render_template("app.html", user_nickname=user["nickname"])


@app.get("/api/auth/me")
def auth_me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False}), 401
    return jsonify(
        {
            "authenticated": True,
            "user": {
                "id": user["id"],
                "phone": user["phone"],
                "nickname": user["nickname"],
            },
        }
    )


@app.post("/api/auth/register")
def auth_register():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    password = (data.get("password") or "").strip()
    nickname = (data.get("nickname") or "").strip() or f"用户{phone[-4:]}" if phone else ""

    if len(phone) != 11 or not phone.isdigit():
        return jsonify({"error": "请输入 11 位手机号"}), 400
    if len(password) < 6:
        return jsonify({"error": "密码至少 6 位"}), 400

    db = get_db()
    exists = db.execute("SELECT id FROM users WHERE phone = ?", (phone,)).fetchone()
    if exists:
        return jsonify({"error": "该手机号已注册"}), 409

    db.execute(
        "INSERT INTO users (phone, password_hash, nickname) VALUES (?, ?, ?)",
        (phone, generate_password_hash(password, method=HASH_METHOD), nickname),
    )
    db.commit()
    return jsonify({"message": "注册成功，请登录"})


@app.post("/api/auth/login")
def auth_login():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    password = (data.get("password") or "").strip()

    if len(phone) != 11 or not phone.isdigit():
        return jsonify({"error": "请输入正确手机号"}), 400
    if not password:
        return jsonify({"error": "请输入密码"}), 400

    db = get_db()
    user = db.execute(
        "SELECT id, phone, nickname, password_hash FROM users WHERE phone = ?",
        (phone,),
    ).fetchone()
    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "手机号或密码错误"}), 401

    session["user_id"] = user["id"]
    return jsonify(
        {
            "message": "登录成功",
            "user": {
                "id": user["id"],
                "phone": user["phone"],
                "nickname": user["nickname"],
            },
        }
    )


@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"message": "已退出登录"})


@app.get("/api/orders")
def order_list():
    user = current_user()
    viewer_id = user["id"] if user else None
    rows = get_db().execute(
        """
        SELECT orders.*, users.nickname
        FROM orders
        JOIN users ON users.id = orders.creator_id
        ORDER BY orders.id DESC
        """
    ).fetchall()
    return jsonify({"orders": [serialize_order(row, viewer_id) for row in rows]})


@app.post("/api/orders")
def order_create():
    user, error = require_auth()
    if error:
        return error

    data = request.get_json(silent=True) or {}
    order_type = (data.get("type") or "").strip()
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    building = (data.get("building") or "").strip()
    same_building = bool(data.get("sameBuilding"))
    is_anonymous = bool(data.get("isAnonymous"))

    try:
        price = float(data.get("price") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "价格格式不正确"}), 400

    if not order_type or not title or not description or not building:
        return jsonify({"error": "请完整填写订单信息"}), 400
    if price <= 0:
        return jsonify({"error": "价格必须大于 0"}), 400

    db = get_db()
    db.execute(
        """
        INSERT INTO orders (
          creator_id, type, title, description, building, same_building,
          is_anonymous, price, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
        """,
        (
            user["id"],
            order_type,
            title,
            description,
            building,
            1 if same_building else 0,
            1 if is_anonymous else 0,
            price,
        ),
    )
    db.commit()
    return jsonify({"message": "发布成功"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)

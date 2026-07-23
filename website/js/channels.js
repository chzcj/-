/**
 * 育见官网 — 渠道配置
 * 替换 QR 图片与外链即可；urlLink 配置后微信内可一键打开育见
 */
window.YUJIAN_CHANNELS = {
  miniprogram: {
    id: 'miniprogram',
    urlLink: '',
    webFallback: 'https://yujian.yihe.site',
    qrImage: 'assets/qr/miniprogram.png',
    modalTitle: '扫码开启 AI 成长陪伴',
    modalDesc: '微信扫码进入育见亲子心智系统',
    matrixLabel: '育见 AI',
    matrixHint: '心智陪伴系统',
  },
  wechatOA: {
    id: 'wechatOA',
    articleUrl: '',
    qrImage: 'assets/qr/wechat-oa.png',
    modalTitle: '关注官方公众号',
    modalDesc: '获取家庭教育专栏干货 · 一合学社',
    matrixLabel: '官方公众号',
    matrixHint: '一合学社内容智库',
  },
  channels: {
    video: {
      id: 'video',
      qrImage: 'assets/qr/channels-video.png',
      modalTitle: '关注视频号',
      modalDesc: '九州问学支教纪实 · 教育纪录片预告',
      matrixLabel: '视频号',
      matrixHint: '支教纪实',
      qrCard: true,
    },
    xiaohongshu: {
      id: 'xiaohongshu',
      qrImage: 'assets/qr/xiaohongshu.png',
      modalTitle: '关注小红书',
      modalDesc: '育儿笔记与家庭教育干货',
      matrixLabel: '小红书',
      matrixHint: '育儿笔记',
    },
    douyin: {
      id: 'douyin',
      qrImage: 'assets/qr/douyin.png',
      modalTitle: '关注抖音',
      modalDesc: '家庭教育干货 · @许元宝',
      matrixLabel: '抖音',
      matrixHint: '家庭教育干货',
      qrCard: true,
    },
  },
};

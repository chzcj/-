/**
 * 育见官网 — 微信/公众号/自媒体入口
 * 微信内：优先 URL Link 一键打开；外部浏览器：弹窗展示二维码
 */
(function () {
  const CONFIG = window.YUJIAN_CHANNELS;
  if (!CONFIG) return;

  const modal = document.getElementById('channel-modal');
  const modalTitle = document.getElementById('channel-modal-title');
  const modalDesc = document.getElementById('channel-modal-desc');
  const modalImg = document.getElementById('channel-modal-qr');
  const modalBackdrop = modal?.querySelector('.channel-modal-backdrop');
  const modalClose = modal?.querySelector('.channel-modal-close');

  function isWeChat() {
    return /MicroMessenger/i.test(navigator.userAgent);
  }

  function resolveChannel(id) {
    if (id === 'miniprogram') return CONFIG.miniprogram;
    if (id === 'wechatOA') return CONFIG.wechatOA;
    return CONFIG.channels?.[id] || null;
  }

  function openModal(channelId) {
    const ch = resolveChannel(channelId);
    if (!modal || !ch || !ch.qrImage) return;

    modalTitle.textContent = ch.modalTitle || '';
    modalDesc.textContent = ch.modalDesc || '';
    modalImg.src = ch.qrImage;
    modalImg.alt = ch.modalTitle || '二维码';
    modalImg.classList.toggle('channel-modal-qr--card', Boolean(ch.qrCard));
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modalClose?.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modalImg.classList.remove('channel-modal-qr--card');
    document.body.style.overflow = '';
  }

  function openMiniprogramEntry() {
    const mp = CONFIG.miniprogram;
    if (isWeChat()) {
      if (mp.urlLink) {
        window.location.href = mp.urlLink;
        return;
      }
      if (mp.webFallback) {
        window.location.href = mp.webFallback;
        return;
      }
    }
    openModal('miniprogram');
  }

  function initChannelElements() {
    document.querySelectorAll('[data-channel]').forEach((el) => {
      const id = el.dataset.channel;
      const ch = resolveChannel(id);
      if (!ch) {
        el.hidden = true;
        return;
      }
      if (el.classList.contains('matrix-card--link')) {
        if (!ch.url) {
          el.hidden = true;
          return;
        }
        el.href = ch.url;
      }
    });
  }

  function handleChannelClick(channelId) {
    const ch = resolveChannel(channelId);
    if (!ch) return;

    if (channelId === 'miniprogram') {
      openMiniprogramEntry();
      return;
    }

    if (channelId === 'wechatOA' && isWeChat() && ch.articleUrl) {
      window.location.href = ch.articleUrl;
      return;
    }

    if (ch.url) {
      window.open(ch.url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (ch.qrImage) {
      openModal(channelId);
    }
  }

  document.querySelectorAll('[data-channel]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const id = el.dataset.channel;
      const ch = resolveChannel(id);

      if (el.tagName === 'A' && ch?.url) {
        e.preventDefault();
        window.open(ch.url, '_blank', 'noopener,noreferrer');
        return;
      }

      e.preventDefault();
      handleChannelClick(id);
    });
  });

  document.querySelectorAll('.js-miniprogram-qr').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('miniprogram');
    });
  });

  document.querySelectorAll('.js-wechat-entry').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openMiniprogramEntry();
    });
  });

  modalClose?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  initChannelElements();

  window.YujianChannel = { openModal, openMiniprogramEntry, isWeChat, handleChannelClick };
})();

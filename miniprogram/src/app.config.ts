export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/daily/index',
    'pages/daily/how-to-speak/index',
    'pages/tasks/index',
    'pages/rehearsal/index',
    'pages/rehearsal/dialogue/index',
    'pages/rehearsal/dialogue-result/index',
    'pages/profile/index',
    'pages/profile/card/index',
    'pages/profile/trajectory/index',
    'pages/profile/deep/index',
    'pages/profile/evidence/index',
    'pages/profile/verify/index',
  ],
  subPackages: [
    {
      root: 'packageOnboarding',
      pages: [
        'pages/intro/index',
        'pages/guide/index',
        'pages/basic/index',
        'pages/hub/index',
        'pages/capture/index',
        'pages/follow-up/index',
        'pages/summary/index',
        'pages/final-follow-up/index',
        'pages/build/index',
        'pages/generating/index',
        'pages/result/index',
      ],
    },
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f8f6e5',
    navigationBarTitleText: '育见',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f8f6e5',
    navigationStyle: 'custom',
  },
  /**
   * permission 仅支持地理位置类 scope（官方文档）。
   * 麦克风不要写在这里——会报「无效的 app.json permission["scope.record"]」。
   * 录音靠：隐私协议（公众平台声明麦克风，微信官方弹窗）+ 运行时 authorize(scope.record)。
   * 勿把 getRecorderManager 写入 requiredPrivateInfos（该字段仅用于地理位置 API）。
   */
  __usePrivacyCheck__: true,
  tabBar: {
    custom: true,
    color: '#868b94',
    selectedColor: '#6f9f56',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/daily/index',
        text: '交流',
      },
      {
        pagePath: 'pages/tasks/index',
        text: '任务',
      },
      {
        pagePath: 'pages/rehearsal/index',
        text: '预演',
      },
      {
        pagePath: 'pages/profile/index',
        text: '画像',
      },
    ],
  },
})

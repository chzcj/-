export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/daily/index',
    'pages/daily/how-to-speak/index',
    'pages/tasks/index',
    'pages/rehearsal/index',
    'pages/profile/index',
    'pages/profile/card/index',
    'pages/profile/deep/index',
  ],
  subPackages: [
    {
      root: 'packageOnboarding',
      pages: [
        'pages/intro/index',
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
  permission: {
    'scope.record': {
      desc: '用于按住说话，记录你对孩子的观察与补充',
    },
  },
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

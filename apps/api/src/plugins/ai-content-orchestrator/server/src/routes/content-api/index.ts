export default () => ({
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/homepage/recommendations',
      handler: 'homepage.publicRecommendations',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/editor-personas',
      handler: 'personas-public.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/editor-personas/:key',
      handler: 'personas-public.findByKey',
      config: {
        auth: false,
      },
    },
  ],
});

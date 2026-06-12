export default {
  routes: [
    {
      method: 'GET',
      path: '/account/me',
      handler: 'account.me',
      config: {
        auth: false,
      },
    },
    {
      method: 'PUT',
      path: '/account/profile',
      handler: 'account.updateProfile',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/account/dashboard',
      handler: 'account.dashboard',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/account/readings',
      handler: 'account.readings',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/account/readings/save-today',
      handler: 'account.saveTodayReading',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/account/subscription/checkout',
      handler: 'account.subscriptionCheckout',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/account/subscription/portal',
      handler: 'account.subscriptionPortal',
      config: {
        auth: false,
      },
    },
    {
      method: 'DELETE',
      path: '/account',
      handler: 'account.deleteAccount',
      config: {
        auth: false,
      },
    },
  ],
};

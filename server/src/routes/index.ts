export default [
  {
    method: 'GET',
    path: '/content-types',
    handler: 'backdate.getContentTypes',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/lookup',
    handler: 'backdate.lookup',
    config: {
      policies: [],
    },
  },
  {
    method: 'PUT',
    path: '/update',
    handler: 'backdate.updateFirstPublishedAt',
    config: {
      policies: [],
    },
  },
];

export const environment = {
  production: true,
  apiEndpoints: {
    postcodes: 'https://api.postcodes.io',
  },
  cache: {
    maxAge: 7200000, // 2 hours
    maxSize: 200
  },
  debounceTime: 300,
  minSearchLength: 2
};
export const environment = {
  production: false,
  apiEndpoints: {
    postcodes: 'https://api.postcodes.io',
  },
  cache: {
    maxAge: 3600000, // 1 hour in milliseconds
    maxSize: 100 // Maximum number of cached items
  },
  debounceTime: 300,
  minSearchLength: 2
};
const open = require('open');

console.log('Opening CrypTopUp Admin Dashboard in browser...');
open('http://localhost:3000/admin').then(() => {
  console.log('Browser opened successfully!');
  console.log('You can log in with these credentials:');
  console.log('Username: admin');
  console.log('Password: cryptopup2023');
}).catch(err => {
  console.error('Failed to open browser:', err);
});

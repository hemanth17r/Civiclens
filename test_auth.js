const admin = require('firebase-admin');

try {
    admin.auth();
    console.log('admin.auth() SUCCESS');
} catch (e) {
    console.log('admin.auth() THREW:', e.message);
}

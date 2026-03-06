const http = require('http');

http.get('http://localhost:3000/api/seed-realistic', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', data.slice(0, 1000)));
});

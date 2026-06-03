try {
    const str = '{"private_key": "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n"}';
    JSON.parse(str);
    console.log("Parse SUCCESS");
} catch(e) {
    console.log("Parse THREW:", e.message);
}

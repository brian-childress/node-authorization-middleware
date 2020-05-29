const jwt = require("jsonwebtoken");

module.exports = (credentials = []) => {
return (req, res, next) => {

// Allow for a string OR array
if (typeof credentials === "string") {
credentials = [credentials];
}

// Find JWT in Headers
const token = req.headers["authorization"];
if (!token) {
return res.status(401).send("Sorry pal: access denied");
} else {
// Validate JWT
// Bearer yndujsoIn...
const tokenBody = token.slice(7);

jwt.verify(tokenBody, 'superSecr3t', (err, decoded) => {
if (err) {
return res.status(200).send("Yo");
}

// Not sure why this works, got an error
if (credentials.length > 0) {
if (
decoded.scopes &&
decoded.scopes.length &&
credentials.some(cred => decoded.scopes.indexOf(cred) >= 0)
) {
next();
} else {
return res.status(200).send("Error: Access Denied");
}
} else {
// No credentials required, user is authorized
next();
}
});
}
};
};

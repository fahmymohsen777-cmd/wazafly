const fs = require('fs');
let css = fs.readFileSync('src/pages/cvBank/CVBank.css', 'utf8');
css = css.replace(/\/\.cv-bank-wrapper \*/g, '/*');
css = css.replace(/\.cv-bank-wrapper \*\//g, '*/');
fs.writeFileSync('src/pages/cvBank/CVBank.css', css);

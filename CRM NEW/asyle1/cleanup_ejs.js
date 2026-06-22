const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.ejs') && f !== 'dashboard.ejs');

files.forEach(file => {
    const filePath = path.join(viewsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Regex to find content from <!DOCTYPE html> to </header>
    // Note: The structure varies, but generally starts with DOCTYPE and ends with </header>
    // or <div class="page-header"> follows </header>

    // Replace Header
    // We look for the closing </header> tag.
    const headerRegex = /<!DOCTYPE html>[\s\S]*?<\/header>/i;
    if (headerRegex.test(content)) {
        content = content.replace(headerRegex, "<%- include('partials/header') %>");
    }

    // Replace Footer
    // We look for <script> tags usually after footer or the <footer ...> tag itself.
    // The footer usually starts with <footer class="asyle-footer"
    const footerRegex = /<footer class="asyle-footer"[\s\S]*?<\/html>/i;
    if (footerRegex.test(content)) {
        content = content.replace(footerRegex, "<%- include('partials/footer') %>");
    }

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
});

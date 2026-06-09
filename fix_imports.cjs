const fs = require('fs');
const path = require('path');

const files = [
    'src/Admin/Components/AdminLayout.jsx',
    'src/Admin/Pages/CustomerProfile.jsx',
    'src/Admin/Pages/Dashboards/ContentCreatorDashboard.jsx',
    'src/Admin/Pages/Dashboards/SecretaryDashboard.jsx',
    'src/Admin/Pages/HistoryPage.jsx',
    'src/Admin/Pages/OrderDetails.jsx',
    'src/Admin/Pages/OrderManagement.jsx',
    'src/Admin/Pages/PaymentRegister.jsx',
    'src/Admin/Pages/PayrollPage.jsx',
    'src/Admin/Pages/ServicePrices.jsx',
    'src/Admin/Pages/UserManagement.jsx'
];

files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if it uses NairaSign but doesn't import it
    if (content.includes('NairaSign') && !content.includes('import NairaSign')) {
        const depth = file.split('/').length - 2;
        let importPath = '../Components/NairaSign';
        if (file.includes('Dashboards')) importPath = '../../Components/NairaSign';
        else if (file.includes('AdminLayout.jsx')) importPath = './NairaSign';

        const importStatement = `import NairaSign from '${importPath}';\n`;
        
        // Insert right after 'import React'
        content = content.replace(/(import React.*?;\r?\n)/, `$1${importStatement}`);
        
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed imports in ' + file);
    }
});

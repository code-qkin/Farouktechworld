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
    if (!content.includes('DollarSign')) return;

    // Remove DollarSign from lucide-react import
    content = content.replace(/DollarSign,\s*/g, '');
    content = content.replace(/,\s*DollarSign/g, '');
    // Catch cases where it's exactly DollarSign in the import
    content = content.replace(/{\s*DollarSign\s*}/g, '{}');

    // Add NairaSign import right after lucide-react
    const depth = file.split('/').length - 2; // e.g. src/Admin/Pages is 2 dirs deep
    let importPath = '../Components/NairaSign';
    if (file.includes('Dashboards')) importPath = '../../Components/NairaSign';
    else if (file.includes('AdminLayout.jsx')) importPath = './NairaSign';

    content = content.replace(/(import .*? from 'lucide-react';)/, `$1\nimport NairaSign from '${importPath}';`);

    // Replace usages
    content = content.replace(/<DollarSign/g, '<NairaSign');
    content = content.replace(/\{DollarSign\}/g, '{NairaSign}');
    content = content.replace(/icon:\s*DollarSign/g, 'icon: NairaSign');

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Updated ' + file);
});

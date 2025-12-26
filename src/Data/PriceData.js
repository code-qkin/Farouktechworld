// Define the model lists for easy range generation
const models = {
    '6_to_17pm': [
        'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 
        'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 
        'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
        'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
        'iPhone 12', 'iPhone 12 Mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
        'iPhone 13', 'iPhone 13 Mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
        'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
        'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
        'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
        'iPhone 17', 'iPhone 17 Plus', 'iPhone 17 Pro', 'iPhone 17 Pro Max'
    ],
    '8_to_17pm': ['iPhone 8', 'iPhone 8 Plus', /* ... add others if needed, using slice logic below is better */],
    // Helper to get slice of models
    getRange: (startStr, endStr) => {
        const all = [
            'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 
            'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 
            'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
            'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
            'iPhone 12', 'iPhone 12 Mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
            'iPhone 13', 'iPhone 13 Mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
            'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
            'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
            'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
            'iPhone 17', 'iPhone 17 Plus', 'iPhone 17 Pro', 'iPhone 17 Pro Max'
        ];
        const start = all.findIndex(m => m.includes(startStr));
        // Simple mapping for range end, defaulting to end of list if "17"
        return start === -1 ? [] : all.slice(start);
    }
};

// Define your specific service ranges
const serviceDefinitions = [
    { name: "Screen Baking", start: "iPhone 6" },
    { name: "Battery Change", start: "iPhone 6" },
    { name: "Battery Swap", start: "iPhone XR" },
    { name: "Battery Swap (Geni)", start: "iPhone 12" },
    { name: "Face ID Repair", start: "iPhone X" },
    { name: "Back Glass Repair", start: "iPhone 8" },
    { name: "Casing Change", start: "iPhone X" },
    { name: "Camera Glass Repair", start: "iPhone X" },
    { name: "Camera Message Repair", start: "iPhone 12 Pro Max" }, // Approximate match
    { name: "Battery Boosting", start: "iPhone XR" },
    { name: "Flex Bonding", start: "iPhone 12 Pro Max" },
    { name: "Line Removal", start: "iPhone 12 Pro Max" },
    { name: "Screen Change (No Msg)", start: "iPhone 11" },
    { name: "Screen Change (With Msg)", start: "iPhone 6" },
    { name: "Charging Port Repair", start: "iPhone 6" },
    { name: "Wireless Repair", start: "iPhone XR" },
    { name: "Screen Disease", start: "iPhone 13 Pro" },
    { name: "Ink Removal", start: "iPhone 6", end: "iPhone 11" }, // Ends at 11
    { name: "Flashlight Repair", start: "iPhone XR" },
    { name: "Earpiece Repair", start: "iPhone X" },
    { name: "Camera Change", start: "iPhone X" },
    { name: "Display Message", start: "iPhone 11" }
];

export const generateServiceData = () => {
    let data = [];
    
    serviceDefinitions.forEach(service => {
        const fullList = models.getRange("iPhone 6", "iPhone 17"); // Get full list reference
        const startIndex = fullList.findIndex(m => m.toLowerCase().includes(service.start.toLowerCase().replace('iphone ', '')));
        
        let validModels = [];
        if (startIndex !== -1) {
            validModels = fullList.slice(startIndex);
            
            // Handle end range if specified (like Ink Removal)
            if (service.end) {
                const endIndex = fullList.findIndex(m => m.toLowerCase().includes(service.end.toLowerCase().replace('iphone ', '')));
                if (endIndex !== -1) {
                    validModels = fullList.slice(startIndex, endIndex + 1); // +1 to include end item
                }
            }
        }

        validModels.forEach(model => {
            data.push({
                service: service.name,
                model: model,
                price: 0 // Default price to 0, Admin will edit this
            });
        });
    });

    return data;
};
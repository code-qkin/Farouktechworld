// --- 1. DEFINE MODELS ---
const models = {
    // Helper to get range of models
    getRange: (startStr, endStr) => {
        const allModels = [
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

        // Find start and end indices
        const start = allModels.findIndex(m => m.toLowerCase().includes(startStr.toLowerCase().replace('iphone ', '')));
        const end = allModels.findIndex(m => m.toLowerCase().includes(endStr.toLowerCase().replace('iphone ', '')));

        if (start === -1) return [];
        // If end is found, slice up to it; otherwise go to end of list
        return end !== -1 ? allModels.slice(start, end + 1) : allModels.slice(start);
    }
};

// --- 2. DEFINE PRODUCT RANGES ---
const productDefinitions = [
    // JCID Products
    { name: "JCID Battery Tag", start: "11", end: "17 Pro Max", category: "Tags" },
    { name: "JCID Face ID Tag", start: "11", end: "17 Pro Max", category: "Tags" },
    { name: "JCID Receiver", start: "X", end: "17 Pro Max", category: "Tags" },
    { name: "JCID Camera Tag", start: "X", end: "17 Pro Max", category: "Tags" },
    { name: "JCID Board", single: true, category: "Tools" }, // Single Item

    // AY Products
    { name: "AY Battery Tag", start: "11", end: "17 Pro Max", category: "Tags" },
    { name: "AY Face ID Tag", start: "11", end: "17 Pro Max", category: "Tags" },

    // Screens
    { name: "Screen (OLED)", start: "X", end: "17 Pro Max", category: "Screens" },
    { name: "Screen (Incell)", start: "X", end: "14 Pro Max", category: "Screens" },
    { name: "Screen (Follow Come)", start: "X", end: "17 Pro Max", category: "Screens" },

    // Housing & Glass
    { name: "Casing (Empty)", start: "X", end: "17 Pro Max", category: "Housing" },
    { name: "Casing (Full)", start: "X", end: "17 Pro Max", category: "Housing" },
    { name: "Back Glass", start: "8", end: "17 Pro Max", category: "Glass" },
    { name: "Frame", start: "X", end: "17 Pro Max", category: "Housing" },
    { name: "Laminating Glass", start: "6", end: "17 Pro Max", category: "Glass" },

    // Accessories
    { name: "Earpiece", start: "X", end: "17 Pro Max", category: "Accessories" },
    { name: "Touch Panel", start: "X", end: "12 Pro Max", category: "Glass" },
    { name: "Down Speaker", start: "X", end: "17 Pro Max", category: "Accessories" },
    { name: "Wireless Coil", start: "X", end: "17 Pro Max", category: "Accessories" },
    { name: "Camera", start: "X", end: "17 Pro Max", category: "Cameras" },
    { name: "Flashlight", start: "X", end: "17 Pro Max", category: "Accessories" },

    // Batteries
    { name: "Battery (Semi-Finished)", start: "6", end: "17 Pro Max", category: "Batteries" },
    { name: "Battery (Finished)", start: "6", end: "17 Pro Max", category: "Batteries" }
];

// --- 3. GENERATOR FUNCTION ---
export const generateStoreData = () => {
    let data = [];

    productDefinitions.forEach(prod => {
        if (prod.single) {
            // Handle single items like "JCID Board"
            data.push({
                name: prod.name,
                category: prod.category,
                model: "Universal",
                price: 0,
                stock: 0
            });
        } else {
            // Handle Ranges
            const range = models.getRange(prod.start, prod.end);
            range.forEach(model => {
                data.push({
                    name: `${prod.name} - ${model}`,
                    category: prod.category,
                    model: model,
                    price: 0, // Default price 0, edit in Dashboard
                    stock: 0
                });
            });
        }
    });

    return data;
};
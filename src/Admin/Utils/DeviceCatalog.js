import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// --- BUILT-IN MASTER REGISTRY ---
export const DEFAULT_DEVICE_MODELS = {
    iPhone: [
        'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 
        'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 
        'iPhone SE (1st Gen)', 'iPhone SE (2nd Gen)', 'iPhone SE (3rd Gen)',
        'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
        'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
        'iPhone 12', 'iPhone 12 Mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
        'iPhone 13', 'iPhone 13 Mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
        'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
        'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
        'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
        'iPhone 17', 'iPhone 17 Plus', 'iPhone 17 Pro', 'iPhone 17 Pro Max'
    ],
    iPad: [
        'iPad (6th Gen)', 'iPad (7th Gen)', 'iPad (8th Gen)', 'iPad (9th Gen)', 'iPad (10th Gen)', 'iPad (11th Gen)',
        'iPad mini 4', 'iPad mini 5', 'iPad mini 6', 'iPad mini 7',
        'iPad Air 2', 'iPad Air 3', 'iPad Air 4', 'iPad Air 5', 'iPad Air 11" (M2)', 'iPad Air 13" (M2)',
        'iPad Pro 9.7"', 'iPad Pro 10.5"',
        'iPad Pro 11" (1st Gen)', 'iPad Pro 11" (2nd Gen)', 'iPad Pro 11" (3rd Gen)', 'iPad Pro 11" (4th Gen)', 'iPad Pro 11" (M4)',
        'iPad Pro 12.9" (1st Gen)', 'iPad Pro 12.9" (2nd Gen)', 'iPad Pro 12.9" (3rd Gen)', 'iPad Pro 12.9" (4th Gen)', 'iPad Pro 12.9" (5th Gen)', 'iPad Pro 12.9" (6th Gen)', 'iPad Pro 13" (M4)'
    ],
    Watch: [
        'Series 1', 'Series 2', 'Series 3', 'Series 4', 'Series 5', 'Series 6', 'Series 7', 'Series 8', 'Series 9', 'Series 10', 'Series 11',
        'SE (1st Gen)', 'SE (2nd Gen)', 'SE (3rd Gen)',
        'Ultra', 'Ultra 2', 'Ultra 3'
    ],
    Samsung: [
        'Samsung S10', 'Samsung S10+', 'Samsung S10e',
        'Samsung S20', 'Samsung S20+', 'Samsung S20 Ultra', 'Samsung S20 FE',
        'Samsung S21', 'Samsung S21+', 'Samsung S21 Ultra', 'Samsung S21 FE',
        'Samsung S22', 'Samsung S22+', 'Samsung S22 Ultra',
        'Samsung S23', 'Samsung S23+', 'Samsung S23 Ultra', 'Samsung S23 FE',
        'Samsung S24', 'Samsung S24+', 'Samsung S24 Ultra', 'Samsung S24 FE',
        'Samsung S25', 'Samsung S25+', 'Samsung S25 Ultra',
        'Samsung Note 10', 'Samsung Note 10+', 'Samsung Note 20', 'Samsung Note 20 Ultra',
        'Samsung Z Fold 3', 'Samsung Z Fold 4', 'Samsung Z Fold 5', 'Samsung Z Fold 6',
        'Samsung Z Flip 3', 'Samsung Z Flip 4', 'Samsung Z Flip 5', 'Samsung Z Flip 6',
        'Samsung A12', 'Samsung A13', 'Samsung A14', 'Samsung A15', 'Samsung A16',
        'Samsung A23', 'Samsung A24', 'Samsung A25',
        'Samsung A33', 'Samsung A34', 'Samsung A35',
        'Samsung A52', 'Samsung A53', 'Samsung A54', 'Samsung A55'
    ]
};

const LOCAL_STORAGE_KEY = 'ftw_device_models_cache';

// Load models from LocalStorage or Default
export const getCachedDeviceModels = () => {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                iPhone: parsed.iPhone || DEFAULT_DEVICE_MODELS.iPhone,
                iPad: parsed.iPad || DEFAULT_DEVICE_MODELS.iPad,
                Watch: parsed.Watch || DEFAULT_DEVICE_MODELS.Watch,
                Samsung: parsed.Samsung || DEFAULT_DEVICE_MODELS.Samsung,
            };
        }
    } catch (e) {
        console.warn('Failed reading cached device models:', e);
    }
    return DEFAULT_DEVICE_MODELS;
};

// Save models to LocalStorage
export const saveCachedDeviceModels = (models) => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(models));
    } catch (e) {
        console.warn('Failed caching device models:', e);
    }
};

// Fetch cloud custom models from Firestore
export const fetchCloudDeviceModels = async () => {
    try {
        const ref = doc(db, 'Settings', 'DeviceModels');
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            const current = getCachedDeviceModels();
            const merged = {
                iPhone: Array.from(new Set([...current.iPhone, ...(data.iPhone || [])])),
                iPad: Array.from(new Set([...current.iPad, ...(data.iPad || [])])),
                Watch: Array.from(new Set([...current.Watch, ...(data.Watch || [])])),
                Samsung: Array.from(new Set([...current.Samsung, ...(data.Samsung || [])]))
            };
            saveCachedDeviceModels(merged);
            return merged;
        }
    } catch (err) {
        console.warn('Could not fetch cloud device models:', err);
    }
    return getCachedDeviceModels();
};

// Add a single custom model to Cloud & Local Cache
export const addCustomDeviceModel = async (brand, newModel) => {
    if (!brand || !newModel || !newModel.trim()) return;
    const cleanModel = newModel.trim();
    const current = getCachedDeviceModels();
    const existingList = current[brand] || [];

    if (existingList.includes(cleanModel)) return current;

    const updatedList = [...existingList, cleanModel];
    const updated = {
        ...current,
        [brand]: updatedList
    };

    saveCachedDeviceModels(updated);

    // Save to Firestore asynchronously
    try {
        const ref = doc(db, 'Settings', 'DeviceModels');
        await setDoc(ref, { [brand]: updatedList }, { merge: true });
    } catch (err) {
        console.warn('Failed saving custom model to cloud:', err);
    }

    return updated;
};

// On-demand fetch from public device catalogues / open APIs
export const syncFromPublicDeviceAPI = async (brand) => {
    let fetched = [];

    try {
        // Query open public device registry for Apple or Samsung
        if (brand === 'iPhone' || brand === 'iPad' || brand === 'Watch') {
            const res = await fetch('https://raw.githubusercontent.com/theapplewiki/theapplewiki.github.io/master/data/devices.json');
            if (res.ok) {
                const data = await res.json();
                const deviceNames = Object.values(data)
                    .map(d => d.name || d.device)
                    .filter(Boolean);

                if (brand === 'iPhone') {
                    fetched = deviceNames.filter(n => n.startsWith('iPhone '));
                } else if (brand === 'iPad') {
                    fetched = deviceNames.filter(n => n.includes('iPad'));
                } else if (brand === 'Watch') {
                    fetched = deviceNames.filter(n => n.includes('Watch') || n.includes('Series') || n.includes('Ultra'));
                }
            }
        } else if (brand === 'Samsung') {
            // Samsung Galaxy open dataset query
            const res = await fetch('https://raw.githubusercontent.com/matthlavacka/carrier-list/master/samsung_models.json');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    fetched = data.map(d => typeof d === 'string' ? d : d.model).filter(Boolean);
                }
            }
        }
    } catch (err) {
        console.warn(`Public device API query for ${brand} had network restriction:`, err.message);
    }

    // Merge fetched with current list
    const current = getCachedDeviceModels();
    const existing = current[brand] || DEFAULT_DEVICE_MODELS[brand] || [];
    const mergedList = Array.from(new Set([...existing, ...fetched]));

    const result = {
        ...current,
        [brand]: mergedList
    };

    saveCachedDeviceModels(result);

    // Persist to Firestore
    try {
        const ref = doc(db, 'Settings', 'DeviceModels');
        await setDoc(ref, { [brand]: mergedList }, { merge: true });
    } catch (e) {
        // Non-blocking
    }

    return result;
};

import { writable } from 'svelte/store';

export function createSyncedStore(key: string, initialValue: any) {
    const store = writable(initialValue);
    let isUpdatingFromChrome = false;
    let isUpdatingFromStore = false;

    // Initialize the store with the value from Chrome storage - in case it already exists
    chrome.storage.sync.get(key, (result) => {
        if (Object.hasOwn(result, key)) {
            isUpdatingFromChrome = true;
            store.set(result[key]);
            isUpdatingFromChrome = false;
        }
    });

    // Update Chrome storage when the store changes
    store.subscribe((value) => {
        if (!isUpdatingFromChrome) {
            isUpdatingFromStore = true;
            chrome.storage.sync.set({ [key]: value }, () => {
                isUpdatingFromStore = false;
            });
        }
    });

    // Listen for changes in Chrome storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes[key] && !isUpdatingFromStore) {
            isUpdatingFromChrome = true;
            store.set(changes[key].newValue);
            isUpdatingFromChrome = false;
        }
    });

    return store;
}

// This is from 09/11 19:28. Has default loadFromStorage, and ignores initialValue in that case.
function store<T>(key: string, initialValue: T, loadFromStorage = true) {
    const store = writable(initialValue);
    let isUpdatingFromChrome = false;
    let isUpdatingFromStore = false;
    let isChromeSubscribed = false;
    const debug = true;

    function subscribeStore() {
        if (debug) console.log("STORE subscribe");
        store.subscribe((value) => {
            if (debug) console.log(`[${String(!isUpdatingFromChrome).toUpperCase()}] svelte => chrome ${value}`);
            if (isUpdatingFromChrome) return;

            isUpdatingFromStore = true;
            chrome.storage.sync.set({ [key]: value }).then(() => {
                isUpdatingFromStore = false;
                if (!isChromeSubscribed) {
                    subscribeChrome();
                    isChromeSubscribed = true;
                }
            });
            if (debug) console.log(`[END]  svelte => chrome ${value}`);
        });
    }

    function subscribeChrome() {
        if (debug) console.log("CHROME subscribe");
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (debug) console.log(`[${String(!isUpdatingFromStore).toUpperCase()}] chrome => svelte ${changes[key].newValue}`);

            if (isUpdatingFromStore || namespace !== 'sync' || !(Object.hasOwn(changes, key))) return;
            isUpdatingFromChrome = true;
            store.set(changes[key].newValue);
            isUpdatingFromChrome = false;

            if (debug) console.log(`[END]  chrome => svelte ${changes[key].newValue}`);
        });
    }

    // Initialize the store with the value from Chrome storage
    if (loadFromStorage) {
        chrome.storage.sync.get(key).then((result) => {
            let value = Object.hasOwn(result, key) ? result[key] : initialValue;
            if (debug) console.log(`[START] storage.sync.get => ${Object.hasOwn(result, key)}: ${value}`);
            store.set(value);
            subscribeStore();
            if (debug) console.log(`[END]   storage.sync.get => ${Object.hasOwn(result, key)}: ${value}`);
        });
    } else {
        subscribeStore();
    }

    return store;
}

export function printChromeStorageSync() {
    chrome.storage.sync.get(null, (items) => {
        if (chrome.runtime.lastError) {
            console.error('Error fetching Chrome storage sync:', chrome.runtime.lastError);
            return;
        }

        console.log('Chrome Storage Sync Contents:');
        if (Object.keys(items).length === 0) {
            console.log('No items found in storage.');
        } else {
            for (const [key, value] of Object.entries(items)) {
                console.log(`\t${key}: ${JSON.stringify(value)}`);
            }
        }
    });
}
// printChromeStorageSync();

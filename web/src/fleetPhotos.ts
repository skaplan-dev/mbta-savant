// Car page hero photos: one per fleet look, from Wikimedia Commons. These show the fleet, not the
// exact car. Every photo is CC BY or CC BY-SA, so the hero always shows its credit and links to the
// source page. Files live in src/assets/fleet-photos/<photo>.jpg (1000px wide, resized from Commons);
// importing them through Vite gives hashed URLs, so a replaced photo isn't stuck in the immutable cache.

export interface FleetPhoto {
    /** File name under /fleet-photos, without the extension. */
    photo: string;
    artist: string;
    license: string;
    /** File name on Wikimedia Commons (the part after "File:"). */
    commons: string;
    /** CSS object-position, for photos whose subject isn't centered. */
    position?: string;
}

const PHOTOS: Record<string, Omit<FleetPhoto, 'photo'>> = {
    'red-pullman': {
        artist: 'Ethan Long',
        license: 'CC BY-SA 2.0',
        commons: 'MBTA Red Line Car -01606 travelling over Longfellow Bridge (53829120291).jpg',
        position: '50% 25%',
    },
    'red-utdc': {
        artist: 'Edward Orde',
        license: 'CC BY-SA 4.0',
        commons: 'Red Line 1700 series car at Alewife (1), November 2019.jpg',
    },
    'red-bombardier': {
        artist: 'Edward Orde',
        license: 'CC BY-SA 4.0',
        commons: 'Red Line 1800 series cars at Alewife station (3), November 2019.jpg',
    },
    'red-crrc': {
        artist: '4300streetcar',
        license: 'CC BY 4.0',
        commons: 'Outbound MBTA Red Line train at Harvard December 2025 1.jpg',
    },
    'orange-crrc': {
        artist: '4300streetcar',
        license: 'CC BY 4.0',
        commons: 'Inbound MBTA Orange Line train at Forest Hills April 2025.jpg',
    },
    'orange-hawker': {
        artist: 'Pi.1415926535',
        license: 'CC BY-SA 3.0',
        commons: 'MBTA Orange Line train at Stony Brook, July 2016.JPG',
    },
    'blue-siemens': {
        artist: '4300streetcar',
        license: 'CC BY 4.0',
        commons: 'MBTA Blue Line train approaching Orient Heights Oct 2024 2.jpg',
    },
    'green-type7': {
        artist: '4300streetcar',
        license: 'CC BY 4.0',
        commons: 'MBTA Green Line Type 7 at Cleveland Circle September 2026.jpg',
    },
    'green-type8': {
        artist: 'Han Zheng',
        license: 'CC BY-SA 2.0',
        commons: 'MBTA Green (E) Line Type 8 LRV (AnsaldoBreda) Harvard Ave (51977634975).jpg',
    },
    'green-type9': {
        artist: '4300streetcar',
        license: 'CC BY 4.0',
        commons: 'Green Line Type 9 3900 at Riverside Yard March 2025.jpg',
    },
    'green-type10': {
        artist: '4300streetcar',
        license: 'CC BY 4.0',
        commons: 'MBTA Green Line Type 10 mockup exterior 7.jpg',
    },
    'mattapan-pcc': {
        artist: '4300streetcar',
        license: 'CC BY 4.0',
        commons: 'PCC streetcar 3260 at Mattapan Station.jpg',
    },
    'bus-d40lf': {
        artist: 'Aria1561',
        license: 'CC BY-SA 4.0',
        commons: 'MBTA New Flyer D40LF 0734 at South Station, March 2023.jpg',
    },
    'bus-de60lfr': {
        artist: 'Aria1561',
        license: 'CC BY-SA 4.0',
        commons: 'MBTA New Flyer DE60LFR 1223 at Copley Square.jpg',
    },
    'bus-xde60': {
        artist: 'Aria1561',
        license: 'CC BY-SA 4.0',
        commons: 'MBTA New Flyer XDE60 1305 at Airport Station, August 2024.jpg',
    },
    'bus-xe60': {
        artist: 'Pi.1415926535',
        license: 'CC BY-SA 4.0',
        commons: 'MBTA 1297 at Southampton Street Garage, March 2022.JPG',
    },
    'bus-xde40': {
        artist: 'Aria1561',
        license: 'CC BY-SA 4.0',
        commons: 'MBTA New Flyer XDE40 3213 at Watertown Square, June 2023.jpg',
    },
    'bus-xn40': {
        artist: 'Han Zheng',
        license: 'CC BY-SA 2.0',
        commons: 'MBTA Route 1 NFI XN40 77 Massachusetts Ave (51977352919).jpg',
    },
    'bus-xe40': {
        artist: '4300streetcar',
        license: 'CC BY 4.0',
        commons: 'MBTA New Flyer XE40 bus 4302 at NEBR Readville April 2025.jpg',
    },
};

/** Roster fleet_key -> photo, for fleets that look alike (same car, different order or year). */
const FLEET_TO_PHOTO: Record<string, string> = {
    'red-1500': 'red-pullman',
    'red-1600': 'red-pullman',
    'green-type7-ks': 'green-type7',
    'green-type7-adtranz': 'green-type7',
    'mattapan-pcc-westinghouse': 'mattapan-pcc',
    'mattapan-pcc-brookville': 'mattapan-pcc',
    'bus-d40lf-2008': 'bus-d40lf',
    'bus-de60lfr-2010': 'bus-de60lfr',
    'bus-xde60-2016': 'bus-xde60',
    'bus-xde60-2018': 'bus-xde60',
    'bus-xde60-2022': 'bus-xde60',
    'bus-xde60-2023': 'bus-xde60',
    'bus-xe60-2019': 'bus-xe60',
    'bus-xde40-2014': 'bus-xde40',
    'bus-xde40-2016': 'bus-xde40',
    'bus-xde40-2017': 'bus-xde40',
    'bus-xde40-2019': 'bus-xde40',
    'bus-xde40-2020': 'bus-xde40',
    'bus-xde40-2023': 'bus-xde40',
    'bus-xn40-2016': 'bus-xn40',
    'bus-xe40-2024': 'bus-xe40',
    'bus-xe40-2025': 'bus-xe40',
};

export function fleetPhoto(fleetKey: string | undefined): FleetPhoto | null {
    if (!fleetKey) return null;
    const photo = FLEET_TO_PHOTO[fleetKey] ?? fleetKey;
    const p = PHOTOS[photo];

    return p ? { photo, ...p } : null;
}

const URLS = import.meta.glob<string>('./assets/fleet-photos/*.jpg', {
    eager: true,
    query: '?url',
    import: 'default',
});

export const photoSrc = (p: FleetPhoto) => URLS[`./assets/fleet-photos/${p.photo}.jpg`];

export const commonsUrl = (p: FleetPhoto) =>
    `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.commons.replaceAll(' ', '_'))}`;

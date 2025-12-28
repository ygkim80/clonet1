import Dexie, { type EntityTable } from 'dexie';

interface DrawingElement {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    points?: number[];
    stroke: string;
    [key: string]: any;
}

export const db = new Dexie('Clonet1Database') as Dexie & {
    elements: EntityTable<DrawingElement, 'id'>;
};

// Define schema
db.version(1).stores({
    elements: 'id, type' // Primary key 'id', index 'type'
});

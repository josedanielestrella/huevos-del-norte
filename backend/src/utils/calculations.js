import { EGG_PER_CARTON } from '../data/store.js';

export function toUnits(mode, quantity) {
  const q = Number(quantity || 0);
  return mode === 'carton' ? q * EGG_PER_CARTON : q;
}

export function unitsToCartons(units) {
  return {
    cartons: Math.floor(units / EGG_PER_CARTON),
    units: units % EGG_PER_CARTON,
    decimalCartons: Number((units / EGG_PER_CARTON).toFixed(2))
  };
}

export function today(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

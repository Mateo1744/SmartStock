/** Configuración base de Metro para Expo SDK 58. */

// Obtiene la configuración oficial de Metro incluida con Expo.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
module.exports = config;

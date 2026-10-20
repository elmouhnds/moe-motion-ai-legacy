'use strict';
/**
 * Curated colour palettes (original MOE selections). Five colours each, ordered dark → light
 * or by role (base, deep, accent, accent 2, light). Used by Backgrounds, Colorize, Shapes and
 * "Save as client" (Brand Kit).
 */
const P = (id, name, tags, colors) => ({ id, name, tags, colors });

const PALETTES = [
  P('tomato', 'MOE Tomato', ['Warm', 'Brand'], ['#1C1C1E', '#2F3A56', '#FF7A59', '#FFB38A', '#F4EDE4']),
  P('midnight', 'Midnight Neon', ['Dark', 'Neon'], ['#0B0F1A', '#1B2440', '#6C5CE7', '#00D1FF', '#FF4D9D']),
  P('sunset', 'Desert Sunset', ['Warm'], ['#2D1B33', '#8C2F39', '#E2711D', '#FFB627', '#FFE8C2']),
  P('ocean', 'Deep Ocean', ['Cool'], ['#03045E', '#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8']),
  P('forest', 'Forest Floor', ['Nature'], ['#1B2D1F', '#2D5A3D', '#6A994E', '#A7C957', '#F2E8CF']),
  P('candy', 'Candy Pop', ['Pastel', 'Fun'], ['#5B2A86', '#FF5D8F', '#7BDFF2', '#B2F7EF', '#F7D6E0']),
  P('mono', 'Mono Studio', ['Neutral'], ['#0D0D0D', '#2B2B2B', '#6B6B6B', '#BDBDBD', '#F5F5F5']),
  P('gold', 'Black & Gold', ['Luxury', 'Dark'], ['#0E0E10', '#1F1A12', '#8C6A2F', '#D4AF37', '#F3E5AB']),
  P('nordic', 'Nordic Frost', ['Cool', 'Neutral'], ['#2E3440', '#4C566A', '#88C0D0', '#D8DEE9', '#ECEFF4']),
  P('citrus', 'Citrus Fresh', ['Fun', 'Warm'], ['#14532D', '#2EC4B6', '#FF9F1C', '#FFBF69', '#FFF8EC']),
  P('berry', 'Berry Night', ['Dark', 'Warm'], ['#2B0F2E', '#5B1E5C', '#A5306B', '#F25F5C', '#FFE066']),
  P('pastel', 'Soft Pastel', ['Pastel'], ['#6D6A75', '#C9E4FF', '#D7F9F1', '#FFEFCF', '#FFD6E0']),
  P('retro', 'Retro 70s', ['Warm', 'Vintage'], ['#3D2C2E', '#D35400', '#E67E22', '#F1C40F', '#ECE2D0']),
  P('cyber', 'Cyberpunk', ['Neon', 'Dark'], ['#0D0221', '#261447', '#FF3864', '#2DE2E6', '#F6019D']),
  P('earth', 'Earth Tones', ['Nature', 'Warm'], ['#432818', '#6F1D1B', '#99582A', '#BB9457', '#FFE6A7']),
  P('mint', 'Mint Clinic', ['Cool', 'Clean'], ['#0B3C49', '#087E8B', '#3CB4A9', '#BFE9DB', '#F5FFFC']),
  P('royal', 'Royal Violet', ['Luxury', 'Cool'], ['#10002B', '#3C096C', '#7B2CBF', '#C77DFF', '#E0AAFF']),
  P('coral', 'Coral Reef', ['Warm', 'Cool'], ['#1F3B4D', '#4A7C8C', '#FF6F61', '#FFA987', '#F7E1D7']),
  P('lava', 'Lava', ['Warm', 'Dark'], ['#1A0A00', '#5C1A00', '#C62E00', '#FF6A00', '#FFC300']),
  P('glacier', 'Glacier', ['Cool', 'Clean'], ['#1D3E5C', '#4F86B0', '#8CB8D8', '#C3DCEC', '#E8F1F8']),
  P('corporate', 'Corporate Blue', ['Clean', 'Brand'], ['#0A2540', '#1A4D8F', '#2F80ED', '#9CC3FF', '#F4F8FF']),
  P('eco', 'Eco Green', ['Nature', 'Clean'], ['#0F3D2E', '#1E7B4F', '#32B37A', '#A8E6C3', '#F0FFF6']),
  P('plum', 'Luxury Plum', ['Luxury'], ['#1E1022', '#3B1F3F', '#8E5572', '#E9C6A7', '#FAF3EB']),
  P('sport', 'Sport Energy', ['Bold'], ['#0B0B0B', '#1F4FFF', '#E10600', '#FFD100', '#FFFFFF']),
  P('playground', 'Playground', ['Fun', 'Bold'], ['#6A4C93', '#1982C4', '#8AC926', '#FFCA3A', '#FF595E']),
  P('cinema', 'Teal & Orange', ['Cinematic'], ['#0F2027', '#203A43', '#2C5364', '#F2994A', '#F2C94C']),
  P('rosegold', 'Rose Gold', ['Luxury', 'Warm'], ['#2B1D1F', '#6E4F52', '#B76E79', '#E8C4C4', '#FFF1EE']),
  P('aurora', 'Aurora', ['Cool', 'Neon'], ['#031B2E', '#0B4F6C', '#01BAEF', '#20BF55', '#FBFBFF']),
  P('terracotta', 'Terracotta', ['Warm', 'Nature'], ['#5B2A1C', '#A0522D', '#D08159', '#F2C3A5', '#FFF4EA']),
  P('ramadan', 'Desert Night', ['Luxury', 'Cultural'], ['#0F1B2D', '#1E3A5F', '#C9A227', '#F4E3B1', '#FFFFFF']),
  P('vapor', 'Vaporwave', ['Neon', 'Pastel'], ['#2B1055', '#7597DE', '#FF71CE', '#01CDFE', '#FFFB96']),
  P('lime', 'Charcoal Lime', ['Bold', 'Dark'], ['#121212', '#1E1E1E', '#3A3A3A', '#C6FF00', '#F5F5F5'])
];

const TAGS = ['All', ...Array.from(new Set(PALETTES.flatMap((p) => p.tags)))];
const byId = (id) => PALETTES.find((p) => p.id === id) || null;

module.exports = { PALETTES, TAGS, byId };

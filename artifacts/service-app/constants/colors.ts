/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#0F172A',
    tint: '#1E3A5F',

    // Core surfaces
    background: '#F8FAFC',
    foreground: '#0F172A',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#0F172A',

    // Primary action color (buttons, links, active states)
    primary: '#1E3A5F',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E8EEF5',
    secondaryForeground: '#1E3A5F',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E2E8F0',
    mutedForeground: '#64748B',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#D97706',
    accentForeground: '#FFFFFF',

    // Destructive actions (delete, error states)
    destructive: '#B91C1C',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#DDE5EF',
    input: '#CBD5E1',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 10,
};

export default colors;

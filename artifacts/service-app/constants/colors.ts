/**
 * Semantic design tokens for Service App (Theme B).
 * Navy primary, slate neutrals, amber accent, soft slate background.
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
    primarySoft: '#EAF1F8',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E8EEF5',
    secondaryForeground: '#1E3A5F',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E2E8F0',
    mutedForeground: '#64748B',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#D97706',
    accentForeground: '#FFFFFF',
    accentSoft: '#FBEEDC',

    // Positive states (confirmed, paid, completed)
    success: '#1F7A46',
    successSoft: '#E6F3EB',

    // Caution states (negotiating, pending)
    warning: '#A16207',
    warningSoft: '#FDF3E3',

    // Destructive actions (delete, error states)
    destructive: '#B91C1C',
    destructiveForeground: '#ffffff',
    destructiveSoft: '#FBE9E9',

    // Borders and input outlines
    border: '#DDE5EF',
    input: '#CBD5E1',
  },

  // Border radius (in px). Applies to cards, buttons, inputs, and modals.
  radius: 10,
};

export default colors;

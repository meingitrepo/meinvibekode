    // --- Release changelog (Alt+Shift+W): newest first. release.sh adds each release's entry at the marker below. ---
    const CHANGELOG = [
        // CHANGELOG-ENTRIES (release.sh inserts below this line)
        ["9.56", "Make no-toasts the single home for toast wording"],
        ["9.55", "Selected count no longer cut off: panel is 400px wide"],
        ["9.54", "Make anthropic-style the single home for design rules; remove redundant style checks from surfaces"],
        ["9.53", "Body and control text raised to 16px on a 24px line height, per the design guideline"],
        ["9.52", "Ink primary button, lighter hairline, 4px spacing scale, 2px focus ring, serif dialog titles"],
        ["9.51", "The outline around a selected annotation uses warm slate and ivory instead of pure black and white"],
        ["9.50", "The note editor's Save button has the same fully rounded 8px corners as every other button"],
        ["9.49", "Anthropic Sans and Serif first, Poppins and Lora next, Arial and Georgia as fallbacks; font-install hint removed"],
        ["9.48", "What's new entries stack the version above the text with roomier spacing"],
        ["9.47", "What's new panel: narrow version column, roomier rows and padding"],
        ["9.46", "The selection toolbar toggle now uses the cursor icon, and the note editor Tab test matches the disabled Save and Erase buttons."],
        ["9.45", "Hiding closes the panel; menu panel/search show pressed; toolbar button disabled with pen"],
        ["9.44", "Annotations hidden by default; panel and pen show them while open"],
        ["9.43", "Alt+Shift+H shortcut guide, Alt+Shift+W release changelog, opens once after each update"],
        ['9.42', 'List-checks icon for Alt+O'],
        ['9.41', 'Hide button pressed while annotations are shown'],
        ['9.40', 'Alt+Shift+O keeps the magnifying-glass icon'],
        ['9.38', 'Magnifying-glass icons for the search lists'],
        ['9.37', 'Shortcuts-off icon drawn like Phosphor\'s slash icons'],
        ['9.36', 'Erase note is disabled until the note is saved'],
        ['9.35', 'Keyboard-slash icon when shortcuts are off'],
        ['9.34', 'Pen mode icon shows on or off'],
        ['9.33', 'Erase note tooltip; clicks on empty page keep list-ticked annotations selected']
    ];

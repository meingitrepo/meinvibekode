    // =====================================================================
    // On-page UI: selection toolbar, note card, note editor and toast.
    //
    // Styled after Fluent 2, Microsoft's current Fluent UI design language (the look of Fluent UI
    // React v9 and Fluent UI Web Components v3): its web light and dark theme tokens, type ramp,
    // corner radii, shadows and motion, and the anatomy of its Button, Toolbar, Tooltip, Popover,
    // Textarea and Toast. The Fluent libraries themselves aren't loaded: they need React or the
    // page's custom-element registry, which a userscript can't rely on. Icons are Fluent UI
    // System Icons.
    //
    // Everything lives in a closed shadow root, so page CSS can't restyle it and its CSS can't
    // leak into the page. Built with createElement (never innerHTML) so pages that enforce
    // Trusted Types don't block it.
    // =====================================================================

    function makeEl(tag, props = {}, children = []) {
        const node = document.createElement(tag);
        Object.keys(props).forEach(k => {
            if (k === 'class') node.className = props[k];
            else if (k === 'text') node.textContent = props[k];
            else node.setAttribute(k, props[k]);
        });
        children.forEach(c => node.appendChild(c));
        return node;
    }


    function svgEl(tag, attrs) {
        const node = document.createElementNS(SVG_NS, tag);
        Object.keys(attrs).forEach(k => node.setAttribute(k, String(attrs[k])));
        return node;
    }

    // Fluent UI System Icons (@fluentui/svg-icons 1.1.343), path data as published.
    // Copyright (c) Microsoft Corporation. MIT License: https://github.com/microsoft/fluentui-system-icons
    const FLUENT_ICONS = {
        highlight_accent_20_filled: 'M16.5 3v4a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V3zm-10 7.5v7l6.45-3.1a1 1 0 0 0 .55-.9v-3z',
        highlight_20_regular: 'M3.5 2c.28 0 .5.22.5.5v4c0 .28.22.5.5.5h11a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 1 0v4c0 .65-.42 1.2-1 1.41V9a2 2 0 0 1-2 2v2.07a2 2 0 0 1-1.1 1.8l-6.18 3.08A.5.5 0 0 1 6 17.5V11a2 2 0 0 1-2-2V7.91c-.58-.2-1-.76-1-1.41v-4c0-.28.22-.5.5-.5M5 8v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8zm2 3v5.7l5.45-2.73a1 1 0 0 0 .55-.9V11z',
        text_underline_20_regular: 'M6 3.5a.5.5 0 0 0-1 0v6.45A5 5 0 0 0 10 15c2.77 0 5-2.26 5-5.05V3.5a.5.5 0 0 0-1 0v6.45C14 12.2 12.2 14 10 14s-4-1.8-4-4.05zm-1 13c0-.28.22-.5.5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5',
        text_strikethrough_20_regular: 'M6.53 4.03A6 6 0 0 1 10 3a6.2 6.2 0 0 1 4.9 2.2.5.5 0 0 1-.8.6A5.2 5.2 0 0 0 10 4c-1.15 0-2.18.35-2.9.85C6.36 5.35 6 5.98 6 6.5c0 .9.43 1.48 1.17 1.93q.54.32 1.25.57H6.23A3 3 0 0 1 5 6.5c0-.98.64-1.86 1.53-2.47M16.5 10a.5.5 0 0 1 0 1h-2.73A3 3 0 0 1 15 13.5c0 1.23-.72 2.12-1.68 2.68-.94.56-2.16.82-3.32.82a7 7 0 0 1-2.9-.48 4.6 4.6 0 0 1-2.02-1.74.5.5 0 0 1 .84-.56c.45.68.96 1.11 1.58 1.38.64.28 1.44.4 2.5.4 1.03 0 2.06-.24 2.82-.68.74-.44 1.18-1.05 1.18-1.82 0-.9-.43-1.48-1.17-1.93q-.54-.32-1.25-.57H3.5a.5.5 0 0 1 0-1z',
        checkmark_20_regular: 'M3.37371 10.1678C3.19025 9.96143 2.87421 9.94284 2.66782 10.1263C2.46143 10.3098 2.44284 10.6258 2.6263 10.8322L6.6263 15.3322C6.81743 15.5472 7.15013 15.557 7.35356 15.3536L17.8536 4.85355C18.0488 4.65829 18.0488 4.34171 17.8536 4.14645C17.6583 3.95118 17.3417 3.95118 17.1465 4.14645L7.02141 14.2715L3.37371 10.1678Z',
        pin_20_regular: 'M10.12 3.14a2 2 0 0 1 3.2-.52l4.06 4.05a2 2 0 0 1-.52 3.2l-3.46 1.74a1.5 1.5 0 0 0-.72.78L11.25 16a1 1 0 0 1-1.64.33L7 13.7 3.7 17H3v-.7L6.3 13l-2.62-2.61a1 1 0 0 1 .34-1.64L7.6 7.32q.52-.23.78-.72zm2.5.18a1 1 0 0 0-1.6.26L9.29 7.04a2.5 2.5 0 0 1-1.31 1.2L4.39 9.69l5.93 5.93 1.43-3.59a2.5 2.5 0 0 1 1.2-1.3l3.47-1.74a1 1 0 0 0 .25-1.6z',
        edit_20_regular: 'M17.18 2.93a2.97 2.97 0 0 0-4.26-.06l-9.37 9.38q-.5.5-.66 1.2l-.88 3.94a.5.5 0 0 0 .6.6l3.93-.87c.46-.1.9-.34 1.23-.68l9.36-9.36a2.97 2.97 0 0 0 .05-4.15m-3.55.65a1.97 1.97 0 1 1 2.8 2.8l-.68.66-2.8-2.79zm-1.38 1.38 2.8 2.8-7.99 7.97q-.31.31-.74.41l-3.16.7.7-3.18q.1-.41.4-.7z',
        eraser_20_regular: 'M11.2 2.44a1.5 1.5 0 0 1 2.12 0l4.24 4.24a1.5 1.5 0 0 1 0 2.12L9.36 17h5.14a.5.5 0 1 1 0 1H7.82a1.5 1.5 0 0 1-1.14-.44l-4.24-4.24a1.5 1.5 0 0 1 0-2.12zm1.41.7a.5.5 0 0 0-.7 0L5.53 9.52l4.95 4.95 6.36-6.36a.5.5 0 0 0 0-.71zM9.78 15.18l-4.95-4.95-1.69 1.69a.5.5 0 0 0 0 .7l4.25 4.25c.2.2.5.2.7 0z',
        delete_20_regular: 'M8.5 4h3a1.5 1.5 0 0 0-3 0m-1 0a2.5 2.5 0 0 1 5 0h5a.5.5 0 0 1 0 1h-1.05l-1.2 10.34A3 3 0 0 1 12.27 18H7.73a3 3 0 0 1-2.98-2.66L3.55 5H2.5a.5.5 0 0 1 0-1zM5.74 15.23A2 2 0 0 0 7.73 17h4.54a2 2 0 0 0 1.99-1.77L15.44 5H4.56zM8.5 7.5c.28 0 .5.22.5.5v6a.5.5 0 0 1-1 0V8c0-.28.22-.5.5-.5M12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z',
        select_all_on_20_regular: 'M12.33 6.62c.2.18.22.5.04.7l-3.5 4a.5.5 0 0 1-.73.03l-2-2a.5.5 0 1 1 .7-.7l1.63 1.62 3.15-3.6c.18-.2.5-.23.7-.05M3 6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm3-2a2 2 0 0 0-2 2v6c0 1.1.9 2 2 2h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-.25 12c.55.61 1.35 1 2.24 1h4.5a4.5 4.5 0 0 0 4.5-4.5V8c0-.88-.38-1.68-.99-2.23V11q0 .15-.01.3v1.2a3.5 3.5 0 0 1-3.5 3.5h-1.43l-.06.01z',
        select_all_off_20_regular: 'M6 3a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zM4 6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm3.99 11c-.89 0-1.69-.39-2.24-1h5.25q.03 0 .05-.01h1.44a3.5 3.5 0 0 0 3.5-3.5v-1.2q.01-.15.01-.3V5.77c.61.55.99 1.35.99 2.23v4.5a4.5 4.5 0 0 1-4.5 4.5z',
        copy_20_regular: 'M7 7H5.5C4.67 7 4 7.67 4 8.5v6c0 .83.67 1.5 1.5 1.5h4c.65 0 1.2-.42 1.41-1h1.04a2.5 2.5 0 0 1-2.45 2h-4A2.5 2.5 0 0 1 3 14.5v-6A2.5 2.5 0 0 1 5.5 6H7zm7.5-4A2.5 2.5 0 0 1 17 5.5v6a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 8 11.5v-6A2.5 2.5 0 0 1 10.5 3zm-4 1C9.67 4 9 4.67 9 5.5v6c0 .83.67 1.5 1.5 1.5h4c.83 0 1.5-.67 1.5-1.5v-6c0-.83-.67-1.5-1.5-1.5z',
        dismiss_20_regular: 'm4.09 4.22.06-.07a.5.5 0 0 1 .63-.06l.07.06L10 9.29l5.15-5.14a.5.5 0 0 1 .63-.06l.07.06c.18.17.2.44.06.63l-.06.07L10.71 10l5.14 5.15c.18.17.2.44.06.63l-.06.07a.5.5 0 0 1-.63.06l-.07-.06L10 10.71l-5.15 5.14a.5.5 0 0 1-.63.06l-.07-.06a.5.5 0 0 1-.06-.63l.06-.07L9.29 10 4.15 4.85a.5.5 0 0 1-.06-.63l.06-.07z',
        chevron_down_16_regular: 'M3.15 5.65c.2-.2.5-.2.7 0L8 9.79l4.15-4.14a.5.5 0 0 1 .7.7l-4.5 4.5a.5.5 0 0 1-.7 0l-4.5-4.5a.5.5 0 0 1 0-.7',
        chevron_right_16_regular: 'M5.65 3.15a.5.5 0 0 0 0 .7L9.79 8l-4.14 4.15a.5.5 0 0 0 .7.7l4.5-4.5a.5.5 0 0 0 0-.7l-4.5-4.5a.5.5 0 0 0-.7 0',
        search_20_regular: 'M13.73 14.44a6.5 6.5 0 1 1 .7-.7l3.42 3.4a.5.5 0 0 1-.63.77l-.07-.06zm-.71-.71A5.5 5.5 0 0 0 15 9.5a5.5 5.5 0 1 0-1.98 4.23',
        eye_off_20_regular: 'M2.85 2.15a.5.5 0 1 0-.7.7l3.5 3.5a8 8 0 0 0-3.37 5.05.5.5 0 1 0 .98.2 7 7 0 0 1 3.1-4.53l1.6 1.59a3.5 3.5 0 1 0 4.88 4.89l4.3 4.3a.5.5 0 0 0 .71-.7zm9.27 10.68a2.5 2.5 0 1 1-3.45-3.45zm-2-4.83 3.38 3.38A3.5 3.5 0 0 0 10.12 8M10 6q-.86 0-1.67.21l-.8-.8A8 8 0 0 1 10 5c3.7 0 6.94 2.67 7.72 6.4a.5.5 0 0 1-.98.2A7 7 0 0 0 10 6',
        warning_20_regular: 'M7.37013 3.55566C8.50949 1.48158 11.4895 1.48168 12.629 3.55566L18.1251 13.5605C19.2227 15.5597 17.7759 18.0046 15.4952 18.0049H4.5039C2.22288 18.0048 0.776902 15.5598 1.87498 13.5605L7.37013 3.55566ZM11.753 4.03711C10.9934 2.65441 9.00677 2.65456 8.24709 4.03711L2.75096 14.042C2.01908 15.3748 2.98329 17.0048 4.5039 17.0049H15.4952C17.0156 17.0046 17.9798 15.3747 17.2481 14.042L11.753 4.03711ZM10 12.75C10.4142 12.7501 10.75 13.0858 10.75 13.5C10.75 13.9141 10.4141 14.2499 10 14.25C9.58587 14.25 9.2501 13.9141 9.25003 13.5C9.25003 13.0858 9.58582 12.75 10 12.75ZM10 6.5C10.2761 6.50007 10.5 6.7239 10.5 7V11C10.5 11.276 10.2761 11.4999 10 11.5C9.72394 11.5 9.50011 11.2761 9.50003 11V7C9.50003 6.72386 9.72389 6.5 10 6.5Z',
        arrow_undo_20_regular: 'M5 2.5C5 2.22386 4.77614 2 4.5 2C4.22386 2 4 2.22386 4 2.5V7.4C4 7.73137 4.26863 8 4.6 8H9.5C9.77614 8 10 7.77614 10 7.5C10 7.22386 9.77614 7 9.5 7H5.90603L9.37872 3.98124C11.046 2.53191 13.5725 2.70858 15.0218 4.37584C16.4711 6.0431 16.2945 8.56959 14.6272 10.0189L6.45529 17.1226C6.24688 17.3038 6.2248 17.6196 6.40596 17.828C6.58713 18.0364 6.90294 18.0585 7.11135 17.8774L15.2833 10.7736C17.3673 8.96197 17.5882 5.80385 15.7765 3.71978C13.9648 1.63571 10.8067 1.41487 8.72266 3.22653L5 6.46259V2.5Z',
        error_circle_20_regular: 'M10 2C14.4183 2 18 5.58172 18 10C18 14.4183 14.4183 18 10 18C5.58172 18 2 14.4183 2 10C2 5.58172 5.58172 2 10 2ZM10 3C6.13401 3 3 6.13401 3 10C3 13.866 6.13401 17 10 17C13.866 17 17 13.866 17 10C17 6.13401 13.866 3 10 3ZM10 12.5C10.4142 12.5 10.75 12.8358 10.75 13.25C10.75 13.6642 10.4142 14 10 14C9.58579 14 9.25 13.6642 9.25 13.25C9.25 12.8358 9.58579 12.5 10 12.5ZM10 6C10.2455 6 10.4496 6.17688 10.4919 6.41012L10.5 6.5V11C10.5 11.2761 10.2761 11.5 10 11.5C9.75454 11.5 9.55039 11.3231 9.50806 11.0899L9.5 11V6.5C9.5 6.22386 9.72386 6 10 6Z',
        info_20_regular: 'M10.5 8.91a.5.5 0 0 0-1 .09v4.6a.5.5 0 0 0 1-.1V8.91m.3-2.16a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0M3 10a7 7 0 1 1 14 0 7 7 0 0 1-14 0'
    };

    // A Fluent icon, always drawn at the size it was designed for (the _16_ / _20_ in its name).
    // Never scale one to another size: Fluent keeps line weight constant by drawing each size
    // separately, and a scaled icon's lines come out thinner or thicker than its neighbours'.
    // Inside a button the icon is the 20px one (Fluent's size for a medium button); the 16px
    // size is for icons next to text (the panel's chevrons). `under` and `over` are extra shapes drawn
    // beneath or on top of it, used to paint parts of an icon in an annotation's color.
    function fluentIcon(name, { under = [], over = [] } = {}) {
        const size = /_16_/.test(name) ? 16 : 20;
        const svg = svgEl('svg', { class: `icon icon-${size}`, viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true', focusable: 'false' });
        under.forEach(s => svg.appendChild(s));
        svg.appendChild(svgEl('path', { d: FLUENT_ICONS[name], class: 'ic-r' }));
        over.forEach(s => svg.appendChild(s));
        return svg;
    }

    const FLUENT_FONT = '"Segoe UI", "Segoe UI Web (West European)", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif';

    // Token names and values are Fluent 2's webLightTheme / webDarkTheme. The annotations panel
    // and the toast follow the page's theme, which can differ from that of the other panels
    // (see openPanel and showToast).
    const LIGHT_TOKENS = `
        --colorNeutralForeground1: #242424;
        --colorNeutralForeground2: #424242;
        --colorNeutralForegroundDisabled: #bdbdbd;
        --colorNeutralForeground2Hover: #242424;
        --colorNeutralForeground2Pressed: #242424;
        --colorNeutralForeground2Selected: #242424;
        --colorNeutralForeground2BrandHover: #0f6cbd;
        --colorNeutralForeground2BrandPressed: #115ea3;
        --colorNeutralForeground2BrandSelected: #0f6cbd;
        --colorNeutralForeground3: #616161;
        --colorNeutralForeground4: #707070;
        --colorNeutralBackground1: #ffffff;
        --colorSubtleBackgroundHover: #f5f5f5;
        --colorSubtleBackgroundPressed: #e0e0e0;
        --colorSubtleBackgroundSelected: #ebebeb;
        --colorNeutralStroke1: #d1d1d1;
        --colorNeutralStroke1Hover: #c7c7c7;
        --colorNeutralStroke1Pressed: #b3b3b3;
        --colorNeutralStrokeAccessible: #616161;
        --colorNeutralStrokeAccessibleHover: #575757;
        --colorCompoundBrandStroke: #0f6cbd;
        --colorCompoundBrandBackground: #0f6cbd;
        --colorCompoundBrandBackgroundHover: #115ea3;
        --colorNeutralStrokeAccessiblePressed: #4d4d4d;
        --colorNeutralStrokeDisabled: #e0e0e0;
        --colorCompoundBrandBackgroundPressed: #0f548c;
        --colorCompoundBrandStrokeHover: #115ea3;
        --colorCompoundBrandStrokePressed: #0f548c;
        --colorCompoundBrandForeground1: #0f6cbd;
        --colorCompoundBrandForeground1Hover: #115ea3;
        --colorCompoundBrandForeground1Pressed: #0f548c;
        --colorNeutralForegroundOnBrand: #ffffff;
        --colorBrandForeground1: #0f6cbd;
        --colorPaletteRedForeground1: #b10e1c;
        --colorPaletteGreenForeground1: #107c10;
        --colorPaletteDarkOrangeForeground1: #bc4b09;
        --colorBrandForegroundLink: #115ea3;
        --colorBrandForegroundLinkHover: #0f548c;
        --colorBrandForegroundLinkPressed: #0c3b5e;
        --colorStrokeFocus1: #ffffff;
        --colorStrokeFocus2: #000000;
        --colorTransparentStroke: transparent;
        --colorBackgroundOverlay: rgba(0, 0, 0, 0.4);
        --shadow8: 0 0 2px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.14);
        --shadow16: 0 0 2px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.14);
        --shadow64: 0 0 8px rgba(0, 0, 0, 0.12), 0 32px 64px rgba(0, 0, 0, 0.14);
        --borderRadiusSmall: 2px;
        --borderRadiusMedium: 4px;
        --borderRadiusXLarge: 8px;
        /* Not a Fluent token: the separator color measured from Edge's PDF selection toolbar. */
        --toolbarDivider: #c6c6c6;
        --durationFaster: 100ms;
        --durationNormal: 200ms;
        --durationSlow: 300ms;
        --curveEasyEase: cubic-bezier(0.33, 0, 0.67, 1);
        --curveDecelerateMax: cubic-bezier(0.1, 0.9, 0.2, 1);
        --curveAccelerateMax: cubic-bezier(0.9, 0.1, 1, 0.2);
        --colorScheme: light;
    `;
    const DARK_TOKENS = `
        --colorNeutralForeground1: #ffffff;
        --colorNeutralForeground2: #d6d6d6;
        --colorNeutralForegroundDisabled: #5c5c5c;
        --colorNeutralForeground2Hover: #ffffff;
        --colorNeutralForeground2Pressed: #ffffff;
        --colorNeutralForeground2Selected: #ffffff;
        --colorNeutralForeground2BrandHover: #479ef5;
        --colorNeutralForeground2BrandPressed: #2886de;
        --colorNeutralForeground2BrandSelected: #479ef5;
        --colorNeutralForeground3: #adadad;
        --colorNeutralForeground4: #999999;
        --colorNeutralBackground1: #292929;
        --colorSubtleBackgroundHover: #383838;
        --colorSubtleBackgroundPressed: #2e2e2e;
        --colorSubtleBackgroundSelected: #333333;
        --colorNeutralStroke1: #666666;
        --colorNeutralStroke1Hover: #757575;
        --colorNeutralStroke1Pressed: #6b6b6b;
        --colorNeutralStrokeAccessible: #adadad;
        --colorNeutralStrokeAccessibleHover: #bdbdbd;
        --colorCompoundBrandStroke: #479ef5;
        --colorCompoundBrandBackground: #479ef5;
        --colorCompoundBrandBackgroundHover: #62abf5;
        --colorNeutralStrokeAccessiblePressed: #b3b3b3;
        --colorNeutralStrokeDisabled: #424242;
        --colorCompoundBrandBackgroundPressed: #2886de;
        --colorCompoundBrandStrokeHover: #62abf5;
        --colorCompoundBrandStrokePressed: #2886de;
        --colorCompoundBrandForeground1: #479ef5;
        --colorCompoundBrandForeground1Hover: #62abf5;
        --colorCompoundBrandForeground1Pressed: #2886de;
        --colorNeutralForegroundOnBrand: #ffffff;
        --colorBrandForeground1: #479ef5;
        --colorPaletteRedForeground1: #dc626d;
        --colorPaletteGreenForeground1: #54b054;
        --colorPaletteDarkOrangeForeground1: #f4a082;
        --colorBrandForegroundLink: #479ef5;
        --colorBrandForegroundLinkHover: #62abf5;
        --colorBrandForegroundLinkPressed: #2886de;
        --colorStrokeFocus1: #000000;
        --colorStrokeFocus2: #ffffff;
        --colorBackgroundOverlay: rgba(0, 0, 0, 0.5);
        --shadow8: 0 0 2px rgba(0, 0, 0, 0.24), 0 4px 8px rgba(0, 0, 0, 0.28);
        --shadow16: 0 0 2px rgba(0, 0, 0, 0.24), 0 8px 16px rgba(0, 0, 0, 0.28);
        --shadow64: 0 0 8px rgba(0, 0, 0, 0.2), 0 32px 64px rgba(0, 0, 0, 0.24);
        --toolbarDivider: #666666;
        --colorScheme: dark;
    `;
    const UI_CSS = `
        :host { all: initial; ${LIGHT_TOKENS} }
        :host([data-theme="dark"]) { ${DARK_TOKENS} }
        .panel[data-theme="light"], .toast[data-theme="light"], .pen[data-theme="light"], .everything[data-theme="light"] { ${LIGHT_TOKENS} }
        .panel[data-theme="dark"], .toast[data-theme="dark"], .pen[data-theme="dark"], .everything[data-theme="dark"] { ${DARK_TOKENS} }
        [hidden]:not(.surface):not(.everything), .tip[hidden] { display: none !important; }
        /* Surfaces fade out rather than vanish: display flips last (allow-discrete), so the hidden attribute
           still takes effect at once for scripts. */
        .surface:not(.tip) { transition: opacity var(--durationNormal) var(--curveAccelerateMax), transform var(--durationNormal) var(--curveAccelerateMax), display var(--durationNormal) allow-discrete; }
        .everything { transition: opacity var(--durationNormal) var(--curveAccelerateMax), display var(--durationNormal) allow-discrete; }
        .everything[hidden] { display: none; opacity: 0; pointer-events: none; }
        .everything:not([hidden]) { animation: highlighter-fade var(--durationNormal) var(--curveDecelerateMax); }
        @keyframes highlighter-fade { from { opacity: 0; } }
        .surface:not(.tip)[hidden] { display: none; opacity: 0; transform: translateY(4px); pointer-events: none; }
        /* Scrollbars (note box, card text, lists) follow our theme, not the page's. Set here, not on
           :host: the host's inline all: initial !important would reset it. */
        .surface, .everything { color-scheme: var(--colorScheme); }

        /* Every floating panel (toolbar, note preview, note editor, toast, tooltip) shares this
           surface: 8px corners and shadow8, matched to Edge's PDF selection toolbar. The toast and
           tooltip use Fluent's 4px corners; the note preview, note editor and panels, a Fluent
           Popover's 4px corners and shadow16. */
        .surface {
            position: fixed; top: 0; left: 0; box-sizing: border-box;
            font-family: ${FLUENT_FONT}; font-size: 14px; line-height: 20px; font-weight: 400;
            color: var(--colorNeutralForeground1); background: var(--colorNeutralBackground1);
            border: 1px solid var(--colorTransparentStroke); border-radius: var(--borderRadiusXLarge);
            box-shadow: var(--shadow8);
            animation: highlighter-enter var(--durationNormal) var(--curveDecelerateMax);
        }
        /* In the page, not the window: they scroll with their text (see uiHost). */
        .surface.toolbar, .surface.tip, .surface.card, .surface.editor { position: absolute; }
        .surface.card, .surface.editor, .surface.panel { border-radius: var(--borderRadiusMedium); box-shadow: var(--shadow16); }
        .surface.panel, .surface.everything-box { box-shadow: var(--shadow64); }
        @keyframes highlighter-enter { from { opacity: 0; transform: translateY(4px); } }

        .icon { display: block; flex: none; fill: currentColor; }
        .icon-20 { width: 20px; height: 20px; }
        .icon-16 { width: 16px; height: 16px; }

        /* Button: Fluent's subtle appearance, size medium (32px), the same in the toolbar and the
           panels, so every icon has the same padding (6px), hover square and spacing. */
        .btn {
            box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
            gap: 6px; min-width: 64px; height: 32px; margin: 0; padding: 0 12px;
            border: 1px solid transparent; border-radius: var(--borderRadiusMedium);
            font-family: inherit; font-size: 14px; line-height: 20px; font-weight: 400;
            cursor: pointer; outline: none; user-select: none; -webkit-tap-highlight-color: transparent;
            transition: background-color var(--durationFaster) var(--curveEasyEase),
                        border-color var(--durationFaster) var(--curveEasyEase),
                        color var(--durationFaster) var(--curveEasyEase);
        }
        .btn:not(.btn-icon) { font-weight: 600; }
        .btn-icon { min-width: 0; width: 32px; padding: 0; }
        .btn-subtle { background: transparent; color: var(--colorNeutralForeground2); }
        /* A style the selected text already has: Fluent's subtle ToggleButton, checked. */
        .btn-subtle[aria-pressed="true"] { background: var(--colorSubtleBackgroundSelected); color: var(--colorNeutralForeground2Selected); }
        .btn-subtle[aria-pressed="true"] .icon { color: var(--colorNeutralForeground2BrandSelected); }
        .btn-subtle:hover { background: var(--colorSubtleBackgroundHover); color: var(--colorNeutralForeground2Hover); }
        /* Fluent's pressed selector: also while a key holds a focused button down. */
        .btn-subtle:hover:active, .btn-subtle:active:focus-visible { background: var(--colorSubtleBackgroundPressed); color: var(--colorNeutralForeground2Pressed); }
        .btn-subtle:hover .icon { color: var(--colorNeutralForeground2BrandHover); }
        .btn-subtle:hover:active .icon, .btn-subtle:active:focus-visible .icon { color: var(--colorNeutralForeground2BrandPressed); }
        /* Fluent's createFocusOutlineStyle: focus border plus a 1px inset ring; the transparent outline shows in forced colors. */
        .btn:focus-visible { border-color: var(--colorStrokeFocus2); outline: 2px solid var(--colorTransparentStroke); box-shadow: inset 0 0 0 1px var(--colorStrokeFocus2); z-index: 1; }
        /* Fluent's disabled subtle button: the note editor's Save while there is nothing to save. */
        .btn-subtle:disabled, .btn-subtle:disabled:hover, .btn-subtle:disabled:active { background: transparent; color: var(--colorNeutralForegroundDisabled); cursor: not-allowed; }
        .btn-subtle:disabled .icon, .btn-subtle:disabled:hover .icon, .btn-subtle:disabled:active .icon { color: var(--colorNeutralForegroundDisabled); }

        /* Annotations selected by clicking them: a solid 1px outline around their lines' shape,
           black, or white on a dark page. */
        .select-box { position: absolute; top: 0; left: 0; pointer-events: none; color: #000000; }
        .select-box[data-theme="dark"] { color: #ffffff; }
        .select-box svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
        .select-box path { fill: none; stroke: currentColor; stroke-width: 1; stroke-linejoin: round; }

        /* Toolbar */
        /* Matched to Edge's PDF selection toolbar: 8px corners, a lighter shadow, and longer,
           darker separators. */
        /* 4px padding: with 32px buttons the toolbar is 40px high, close to Edge's (about 42px). */
        .toolbar { display: flex; align-items: center; gap: round(2px, calc(1px / var(--dpr, 1))); padding: 4px 8px; }
        /* Idle fade-out (see TOOLBAR_IDLE_MS). Pointing at the toolbar brings it back at once. */
        .toolbar.fading { opacity: 0; transition: opacity var(--durationSlow) var(--curveEasyEase); }
        .divider { flex: none; width: calc(1px / var(--dpr, 1)); height: 24px; margin: 0 round(10px, calc(1px / var(--dpr, 1))); background: var(--toolbarDivider); }
        @media (pointer: coarse) { .toolbar .btn-icon { width: 40px; height: 40px; } }

        /* Tooltip */
        /* One line, kept inside the view: nowrap measures the tip at its full width wherever it last
           stood, so placePanel() can move it in from the edge instead of the edge squeezing it. */
        .tip { white-space: nowrap; max-width: calc(100vw - 8px); overflow: hidden; text-overflow: ellipsis; padding: 4px 11px 6px; font-size: 12px; line-height: 16px; border-radius: var(--borderRadiusMedium); pointer-events: none; }
        .tip .kbd { margin-left: 8px; color: var(--colorNeutralForeground3); }

        /* Panels (note preview, note editor, toast) all have 12px padding. Their 32px icon buttons
           are pulled out by 4px with negative margins, so every button sits 8px from the panel's
           edges, every icon 14px, and neighbouring buttons are 2px apart. */

        /* Note preview */
        .card { width: max-content; min-width: 160px; max-width: min(320px, calc(100vw - 16px)); padding: 12px; }
        .card-text { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow: auto; overscroll-behavior: contain; }
        .card-text a { color: var(--colorBrandForegroundLink); text-decoration: underline; border-radius: var(--borderRadiusMedium); outline: none; }
        .card-text a:hover { color: var(--colorBrandForegroundLinkHover); }
        .card-text a:focus-visible { outline: 2px solid var(--colorStrokeFocus2); }
        .card[data-pinned] .card-footer { cursor: move; user-select: none; }
        .card[data-pinned] { z-index: -1; }   /* pinned previews sit under the Alt+O and Alt+Shift+O panels */
        .card-footer { display: flex; align-items: center; gap: 12px; margin: 4px -4px -8px 0; }
        .card-hint { flex: 1; font-size: 12px; line-height: 16px; color: var(--colorNeutralForeground3); }
        .card-actions { display: flex; gap: 2px; }

        /* Note editor, with an outline Textarea */
        /* As wide as its note box, which starts 292px wide (a 320px panel, the note preview at its
           widest) and can be dragged wider, never narrower. */
        .editor { max-width: calc(100vw - 16px); padding: 12px; }
        .editor-header { display: flex; align-items: center; justify-content: space-between; min-height: 32px; margin: -8px -4px 4px 0; }
        /* Save and Delete, icon only, at the top right. */
        .editor-actions { display: flex; align-items: center; gap: 2px; }
        .editor-title { font-weight: 600; }
        .field {
            position: relative; box-sizing: border-box; background: var(--colorNeutralBackground1);
            /* No bottom border: browsers round border widths to device pixels (1px becomes 0.8px at
               125% scaling), so a line positioned to cover a border always misses it by a fraction
               and looks doubled. The bottom edge is drawn by ::before and ::after instead, both
               anchored to the same edge (bottom: 0), so they can't drift apart. */
            border: 1px solid var(--colorNeutralStroke1); border-bottom: 0;
            /* Square bottom corners, so the bottom lines are plain straight lines. */
            border-radius: var(--borderRadiusMedium) var(--borderRadiusMedium) 0 0;
            /* Clips the textarea (and its scrollbar) to the rounded top corners. */
            overflow: hidden;
            /* A 2px strip under the textarea for the bottom lines, so the focus bar never covers
               the textarea's resize grip. */
            padding-bottom: 2px;
        }
        .field:hover { border-color: var(--colorNeutralStroke1Hover); }
        .field::before, .field::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; pointer-events: none; }
        /* The box's bottom edge (what the bottom border used to be). */
        .field::before { height: 1px; background: var(--colorNeutralStrokeAccessible); }
        .field:hover::before { background: var(--colorNeutralStrokeAccessibleHover); }
        .field:active, .field:focus-within { border-color: var(--colorNeutralStroke1Pressed); }
        .field:active::before, .field:focus-within::before { background: var(--colorNeutralStrokeAccessiblePressed); }
        /* Focus line: one solid 2px bar that grows from the center on focus, as in Fluent. */
        .field::after {
            height: 2px; background: var(--colorCompoundBrandStroke);
            transform: scaleX(0); transition: transform 50ms var(--curveEasyEase);
        }
        .field:focus-within::after { transform: scaleX(1); transition: transform var(--durationNormal) var(--curveDecelerateMax); }
        .field:active::after { background: var(--colorCompoundBrandStrokePressed); }
        textarea {
            /* Height is set by sizeNoteInput(): NOTE_MIN_LINES to NOTE_MAX_LINES, then it scrolls.
               The corner handle resizes it (and the panel) for the current edit only. */
            display: block; box-sizing: border-box; width: 292px; min-width: 292px; margin: 0; padding: 5px 11px;
            min-height: 30px; max-width: min(640px, calc(100vw - 50px)); max-height: 60vh;   /* 30px: one line */
            border: 0; outline: 0; resize: both; overflow-y: auto; overscroll-behavior: contain; background: transparent;
            color: var(--colorNeutralForeground1); font: inherit;
        }
        textarea::placeholder { color: var(--colorNeutralForeground4); opacity: 1; }
        /* width 0 + min-width 100%: the hint wraps to the note box's width instead of widening the
           panel, which would leave the box's border wider than the textarea and its scrollbar. */
        .field-hint { width: 0; min-width: 100%; margin-top: 4px; font-size: 12px; line-height: 16px; color: var(--colorNeutralForeground3); }
        /* Toast */
        .toast { top: auto; left: auto; right: 16px; bottom: 16px; display: flex; align-items: flex-start; gap: 8px; width: min(292px, calc(100vw - 32px)); padding: 12px; border-radius: var(--borderRadiusMedium); }
        .toast .icon { color: var(--colorNeutralForeground2); }
        .toast[data-intent="success"] > .icon { color: var(--colorPaletteGreenForeground1); }
        .toast[data-intent="warning"] > .icon { color: var(--colorPaletteDarkOrangeForeground1); }
        .toast[data-intent="error"] > .icon { color: var(--colorPaletteRedForeground1); }
        .toast > .icon { width: 16px; height: 16px; margin-top: 2px; }
        .toast-content { flex: 1; min-width: 0; }
        .toast-text { font-weight: 600; }
        .toast-body { padding-top: 6px; color: var(--colorNeutralForeground1); }
        .toast-body[hidden] { display: none; }
        .toast .btn-icon { margin: -6px 0; }
        .toast .btn-icon:last-child { margin-right: -6px; }
        /* The toast's action (Undo, Restore): a Fluent Link, as in Fluent's Toast. */
        .link {
            flex: none; margin: 0 0 0 4px; padding: 0; border: 0; border-radius: var(--borderRadiusMedium);
            background: none; font: inherit; color: var(--colorBrandForegroundLink);
            cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .link:hover { color: var(--colorBrandForegroundLinkHover); text-decoration: underline; }
        .link:active { color: var(--colorBrandForegroundLinkPressed); text-decoration: underline; }
        .link:focus-visible { text-decoration: underline double; }
        .toast:focus-visible { outline: 2px solid var(--colorStrokeFocus2); }
        /* The pen's bar, centred at the top of the view. */
        .pen { top: 12px; right: 0; margin: 0 auto; width: max-content; max-width: calc(100vw - 32px); display: flex; align-items: center; gap: round(2px, calc(1px / var(--dpr, 1))); padding: 4px 8px; }
        .pen-text { box-sizing: border-box; padding: 0 4px; white-space: nowrap; color: var(--colorNeutralForeground1); }
        /* Everything saved (Alt+Shift+O): a dialog over the dimmed page. */
        .everything { position: fixed; inset: 0; display: flex; align-items: flex-start; justify-content: center; padding: 32px 16px; box-sizing: border-box; background: var(--colorBackgroundOverlay); font-family: ${FLUENT_FONT}; font-size: 14px; line-height: 20px; color: var(--colorNeutralForeground1); }
        .everything-box { position: relative; display: flex; flex-direction: column; width: min(600px, 100%); max-height: 100%; padding: 24px 0 0; }
        .everything-box .panel-header { margin: -4px 18px 12px 24px; }
        .everything-box .field { flex: none; margin: 0 24px 8px; }
        .everything-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 20px 24px; overscroll-behavior: contain; }
        .page-head {
            display: flex; align-items: center; gap: 8px; width: 100%; margin: 0; padding: 6px 4px; border: 0;
            border-radius: var(--borderRadiusMedium); background: none; font: inherit; color: inherit; text-align: left;
            cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .page-head:hover { background: var(--colorSubtleBackgroundHover); }
        .page-head:hover:active { background: var(--colorSubtleBackgroundPressed); }
        .page-head:focus-visible { outline: 2px solid var(--colorStrokeFocus2); outline-offset: -2px; }
        .page-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .page-host { font-weight: 600; }
        .page-path { margin-left: 6px; color: var(--colorNeutralForeground3); }
        .page-meta { flex: none; font-size: 12px; color: var(--colorNeutralForeground3); }
        .page-items { padding-left: 20px; }
        a.item-main { text-decoration: none; }

        /* Annotations panel: a Fluent Drawer-like panel along the right edge, above the page. */
        .panel {
            top: 8px; left: auto; right: 8px; display: flex; flex-direction: column;
            width: min(320px, calc(100vw - 16px)); max-height: calc(100vh - 16px); padding: 12px 0 0;
        }
        .panel-header { display: flex; align-items: center; gap: 8px; min-height: 32px; margin: -8px 8px 4px 12px; }
        .panel-title { font-weight: 600; color: var(--colorNeutralForeground1); }
        /* Fluent's dialog and drawer title: 20/28; the tail ("selected on 3 pages") stays 14/20. */
        .panel-count { flex: 1; font-size: 20px; line-height: 28px; color: var(--colorNeutralForeground3); }
        .panel-tail { font-size: 14px; line-height: 20px; }
        .panel-actions { display: flex; align-items: center; gap: 2px; }
        .panel .field { flex: none; margin: 0 12px 8px; padding-bottom: 0; }
        .search-icon { position: absolute; left: 9px; top: 6px; color: var(--colorNeutralForeground3); pointer-events: none; }
        .field input {
            display: block; box-sizing: border-box; width: 100%; height: 31px; margin: 0; padding: 0 10px 0 33px;
            border: 0; outline: 0; background: transparent; color: var(--colorNeutralForeground1); font: inherit;
        }
        .field input::placeholder { color: var(--colorNeutralForeground4); opacity: 1; }
        .field input::-webkit-search-cancel-button { display: none; }
        .panel-list { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 0 8px 8px; overscroll-behavior: contain; }
        .section-title { margin: 8px 4px 4px; font-size: 12px; line-height: 16px; font-weight: 600; color: var(--colorNeutralForeground3); }
        .empty { margin: 4px 4px 8px; color: var(--colorNeutralForeground3); }
        /* Fluent's checkbox: a 16px square with 2px corners, the brand color and a check mark when
           on, a brand outline with a smaller rounded square when mixed. */
        .check {
            appearance: none; flex: none; position: relative; width: 16px; height: 16px; margin: 0; cursor: pointer;
            border: 1px solid var(--colorNeutralStrokeAccessible); border-radius: var(--borderRadiusSmall); background: transparent;
            transition: background-color 100ms, border-color 100ms; box-sizing: border-box; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .check:hover { border-color: var(--colorNeutralStrokeAccessibleHover); }
        .check:active { border-color: var(--colorNeutralStrokeAccessiblePressed); }
        .check:checked { border-color: var(--colorCompoundBrandBackground); background: var(--colorCompoundBrandBackground); }
        .check:checked:hover { border-color: var(--colorCompoundBrandBackgroundHover); background: var(--colorCompoundBrandBackgroundHover); }
        .check:checked:active { border-color: var(--colorCompoundBrandBackgroundPressed); background: var(--colorCompoundBrandBackgroundPressed); }
        .check:checked::after, .check:indeterminate::after {
            content: ""; position: absolute; inset: 0; background: var(--colorNeutralForegroundOnBrand);
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M9.76 3.2c.3.29.32.76.04 1.06l-4.25 4.5a.75.75 0 0 1-1.08.02L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.7 1.7L8.7 3.24a.75.75 0 0 1 1.06-.04'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M9.76 3.2c.3.29.32.76.04 1.06l-4.25 4.5a.75.75 0 0 1-1.08.02L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.7 1.7L8.7 3.24a.75.75 0 0 1 1.06-.04'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
        }
        .check:indeterminate { border-color: var(--colorCompoundBrandStroke); }
        .check:indeterminate::after {
            background: var(--colorCompoundBrandForeground1);
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4Z'/%3E%3C/svg%3E") center / 12px 12px no-repeat;
        }
        .check:indeterminate:hover { border-color: var(--colorCompoundBrandStrokeHover); }
        .check:indeterminate:hover::after { background: var(--colorCompoundBrandForeground1Hover); }
        .check:indeterminate:active { border-color: var(--colorCompoundBrandStrokePressed); }
        .check:indeterminate:active::after { background: var(--colorCompoundBrandForeground1Pressed); }
        .check:disabled, .check:disabled:hover, .check:disabled:active { cursor: default; border-color: var(--colorNeutralStrokeDisabled); background: transparent; }
        .check:disabled::after { background: var(--colorNeutralForegroundDisabled); }
        .check:focus-visible { outline: 2px solid var(--colorStrokeFocus2); outline-offset: 1px; }
        .item .check { margin: 10px 8px 0 4px; opacity: 0; }
        .item:hover .check, .item .check:checked, .item .check:focus-visible { opacity: 1; }
        @media (hover: none) { .item .check { opacity: 1; } }
        .everything .item .check { margin: 10px 4px 0 8px; }
        .item { display: flex; align-items: flex-start; border-radius: var(--borderRadiusMedium); }
        .item + .item { margin-top: 2px; }
        .item:has(.check:checked) { background: var(--colorSubtleBackgroundSelected); }
        .item:hover { background: var(--colorSubtleBackgroundHover); }
        .item:hover:active { background: var(--colorSubtleBackgroundPressed); }
        /* The annotation itself: a button that scrolls to it. The bar at its left is its color. */
        .item-main {
            position: relative; flex: 1; min-width: 0; display: block; margin: 0; padding: 6px 4px 6px 14px;
            border: 0; border-radius: var(--borderRadiusMedium); background: none; text-align: left;
            font: inherit; color: inherit; cursor: pointer; outline: none; -webkit-tap-highlight-color: transparent;
        }
        .item-main:focus-visible { outline: 2px solid var(--colorStrokeFocus2); outline-offset: -2px; }
        .item-main::before { content: ""; position: absolute; left: 4px; top: 8px; bottom: 8px; width: 4px; border-radius: 2px; background: var(--swatch); }
        .item-text, .item-note { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
        .item-text { -webkit-line-clamp: 3; }
        .item-note { -webkit-line-clamp: 4; white-space: pre-wrap; margin-top: 2px; font-size: 12px; line-height: 16px; color: var(--colorNeutralForeground2); }
        .item-meta { margin-top: 2px; font-size: 12px; line-height: 16px; color: var(--colorNeutralForeground3); }
        .item-actions { display: flex; align-items: center; gap: 2px; padding: 4px 4px 0 0; opacity: 0; }
        .item:hover .item-actions, .item:focus-within .item-actions { opacity: 1; }
        @media (hover: none) { .item-actions { opacity: 1; } }
        .item-actions .btn:not(.btn-icon) { min-width: 0; }
        /* Not found: its actions sit below its text, always shown. */
        .missing { flex-direction: column; align-items: stretch; }
        .missing .item-main { cursor: default; padding-bottom: 2px; }
        .missing .item-main::before { opacity: 0.5; }
        .missing .item-actions { opacity: 1; padding: 0 4px 6px 6px; }

        @media (prefers-reduced-motion: reduce) {
            .surface, .everything { animation: none; transition: none; }
            .btn, .field::after, .toolbar.fading { transition: none; }
        }
        @media (forced-colors: active) {
            .surface { border-color: CanvasText; }
            .btn { border-color: ButtonText; }
            .btn[aria-pressed="true"] { background: Highlight; }
            .btn[aria-pressed="true"] .icon { color: HighlightText; }
            .field::after { background: Highlight; }
            .link, .link:hover, .link:active { color: LinkText; }
            .check { border-color: ButtonText; }
            .check:checked, .check:checked:hover, .check:checked:active { border-color: Highlight; background: Highlight; }
            .check:checked::after { background: HighlightText; }
            .check:indeterminate, .check:indeterminate:hover, .check:indeterminate:active { border-color: Highlight; }
            .check:indeterminate::after, .check:indeterminate:hover::after, .check:indeterminate:active::after { background: Highlight; }
            .check:disabled, .check:disabled:hover, .check:disabled:active { border-color: GrayText; }
            .check:disabled::after { background: GrayText; }
            .item:hover, .item:has(.check:checked), .page-head:hover { background: Highlight; color: HighlightText; }
            .item:hover *, .item:has(.check:checked) *, .page-head:hover * { color: HighlightText; }
            .item-main:focus-visible, .page-head:focus-visible, .check:focus-visible { outline-color: CanvasText; }
            .item-main::before { forced-color-adjust: none; }
            .select-box path { stroke: Highlight; }
        }
    `;


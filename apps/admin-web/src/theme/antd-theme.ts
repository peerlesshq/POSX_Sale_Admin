/**
 * AntD ConfigProvider theme for Phase 7 / audit remediation.
 *
 * Previous state: `adminDarkTheme` was fully wired, `adminLightTheme`
 * was a shallow token spread that inherited ALL dark component
 * overrides. Result: light mode left dark Menu items, dark Table
 * headers, and dark Modal surfaces untouched.
 *
 * This file now builds BOTH themes from a shared component blueprint
 * parameterized by `mode`. Every per-component override is re-resolved
 * for the current mode so switching themes produces a consistent look.
 *
 * Usage:
 *   import { buildAdminAntdTheme } from './antd-theme';
 *   const theme = buildAdminAntdTheme(mode); // mode = 'dark' | 'light'
 *   <ConfigProvider theme={theme}>...</ConfigProvider>
 *
 * Legacy exports `adminDarkTheme` and `adminLightTheme` are retained
 * for any callers that still reference them; they resolve to
 * `buildAdminAntdTheme('dark'|'light')`.
 */
import { theme as antdTheme, type ThemeConfig } from 'antd';

const { darkAlgorithm, defaultAlgorithm } = antdTheme;

/* ------------------------------------------------------------------ */
/*  Brand constants                                                    */
/* ------------------------------------------------------------------ */

const BRAND_INDIGO = '#5b5bff';
const BRAND_INDIGO_HOVER = '#8b93ff';
const BRAND_INDIGO_DEEP = '#4444e6';

const STATUS_INFO = '#38bdf8';
const STATUS_SUCCESS = '#10b981';
const STATUS_WARNING = '#f59e0b';
const STATUS_ERROR = '#f43f5e';

const FONT_FAMILY =
  "'Inter Variable','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif";
const FONT_FAMILY_CODE =
  "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/* ------------------------------------------------------------------ */
/*  Mode-specific palette                                              */
/* ------------------------------------------------------------------ */

interface ModePalette {
  readonly bgBase: string;
  readonly bgLayout: string;
  readonly bgContainer: string;
  readonly bgElevated: string;
  readonly bgSpotlight: string;
  readonly bgInput: string;
  readonly bgHover: string;

  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textTertiary: string;
  readonly textPlaceholder: string;

  readonly border: string;
  readonly borderSubtle: string;
  readonly borderStrong: string;

  readonly menuItemBg: string;
  readonly menuHoverBg: string;
  readonly menuSelectedBg: string;
  readonly menuSelectedText: string;

  readonly tableHeaderBg: string;
  readonly tableRowHoverBg: string;

  readonly buttonDefaultBorder: string;
  readonly buttonDefaultText: string;

  readonly tagDefaultBg: string;
  readonly tagDefaultText: string;

  readonly segmentedTrackBg: string;
  readonly segmentedSelectedBg: string;
  readonly segmentedSelectedText: string;

  readonly dividerSplit: string;
}

const DARK_PALETTE: ModePalette = {
  bgBase: '#0a0d14',
  bgLayout: '#0a0d14',
  bgContainer: '#10141e',
  bgElevated: '#161b27',
  bgSpotlight: '#1b2130',
  bgInput: '#0d1019',
  bgHover: 'rgba(255,255,255,0.04)',

  textPrimary: '#e6ebf5',
  textSecondary: '#a8b0c2',
  textTertiary: '#6b7386',
  textPlaceholder: '#4b5163',

  border: 'rgba(255,255,255,0.1)',
  borderSubtle: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.16)',

  menuItemBg: 'transparent',
  menuHoverBg: 'rgba(255,255,255,0.04)',
  menuSelectedBg: 'rgba(91,91,255,0.14)',
  menuSelectedText: BRAND_INDIGO_HOVER,

  tableHeaderBg: '#161b27',
  tableRowHoverBg: 'rgba(255,255,255,0.04)',

  buttonDefaultBorder: 'rgba(255,255,255,0.16)',
  buttonDefaultText: '#e6ebf5',

  tagDefaultBg: 'rgba(168,176,194,0.1)',
  tagDefaultText: '#a8b0c2',

  segmentedTrackBg: '#0d1019',
  segmentedSelectedBg: '#1b2130',
  segmentedSelectedText: BRAND_INDIGO_HOVER,

  dividerSplit: 'rgba(255,255,255,0.06)',
};

const LIGHT_PALETTE: ModePalette = {
  bgBase: '#ffffff',
  bgLayout: '#f6f7fb',
  bgContainer: '#ffffff',
  bgElevated: '#ffffff',
  bgSpotlight: '#ffffff',
  bgInput: '#ffffff',
  bgHover: 'rgba(15,23,42,0.04)',

  textPrimary: '#0f172a',
  textSecondary: '#475467',
  textTertiary: '#667085',
  textPlaceholder: '#98a2b3',

  border: 'rgba(15,23,42,0.1)',
  borderSubtle: 'rgba(15,23,42,0.06)',
  borderStrong: 'rgba(15,23,42,0.16)',

  menuItemBg: 'transparent',
  menuHoverBg: 'rgba(15,23,42,0.05)',
  menuSelectedBg: 'rgba(91,91,255,0.1)',
  menuSelectedText: BRAND_INDIGO_DEEP,

  tableHeaderBg: '#f6f7fb',
  tableRowHoverBg: 'rgba(15,23,42,0.03)',

  buttonDefaultBorder: 'rgba(15,23,42,0.14)',
  buttonDefaultText: '#0f172a',

  tagDefaultBg: 'rgba(71,84,103,0.08)',
  tagDefaultText: '#475467',

  segmentedTrackBg: '#f1f3f9',
  segmentedSelectedBg: '#ffffff',
  segmentedSelectedText: BRAND_INDIGO_DEEP,

  dividerSplit: 'rgba(15,23,42,0.08)',
};

/* ------------------------------------------------------------------ */
/*  Theme builder                                                      */
/* ------------------------------------------------------------------ */

type AdminMode = 'dark' | 'light';

export function buildAdminAntdTheme(mode: AdminMode): ThemeConfig {
  const p = mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;

  return {
    algorithm: [mode === 'dark' ? darkAlgorithm : defaultAlgorithm],
    cssVar: true,
    hashed: false,
    token: {
      colorPrimary: BRAND_INDIGO,
      colorLink: mode === 'dark' ? BRAND_INDIGO : BRAND_INDIGO_DEEP,
      colorInfo: STATUS_INFO,
      colorSuccess: STATUS_SUCCESS,
      colorWarning: STATUS_WARNING,
      colorError: STATUS_ERROR,

      colorBgBase: p.bgBase,
      colorBgLayout: p.bgLayout,
      colorBgContainer: p.bgContainer,
      colorBgElevated: p.bgElevated,
      colorBgSpotlight: p.bgSpotlight,

      colorText: p.textPrimary,
      colorTextSecondary: p.textSecondary,
      colorTextTertiary: p.textTertiary,
      colorTextDescription: p.textSecondary,
      colorTextPlaceholder: p.textPlaceholder,

      colorBorder: p.border,
      colorBorderSecondary: p.borderSubtle,

      borderRadius: 6,
      borderRadiusLG: 10,
      borderRadiusSM: 4,
      borderRadiusXS: 4,

      fontFamily: FONT_FAMILY,
      fontFamilyCode: FONT_FAMILY_CODE,
      fontSize: 13,
      fontSizeLG: 14,
      fontSizeSM: 12,
      fontSizeXL: 16,
      fontSizeHeading1: 28,
      fontSizeHeading2: 22,
      fontSizeHeading3: 18,
      fontSizeHeading4: 16,
      fontSizeHeading5: 14,

      motionDurationFast: '0.12s',
      motionDurationMid: '0.18s',
      motionDurationSlow: '0.28s',

      wireframe: false,
      controlHeight: 32,
      controlHeightSM: 26,
      controlHeightLG: 38,
    },
    components: {
      Layout: {
        headerBg: p.bgContainer,
        siderBg: p.bgContainer,
        bodyBg: p.bgLayout,
        triggerBg: p.bgElevated,
        colorBgHeader: p.bgContainer,
      },
      Menu: {
        // Dark-mode tokens
        darkItemBg: 'transparent',
        darkSubMenuItemBg: 'transparent',
        darkItemHoverBg: DARK_PALETTE.menuHoverBg,
        darkItemSelectedBg: DARK_PALETTE.menuSelectedBg,
        darkItemSelectedColor: DARK_PALETTE.menuSelectedText,
        darkItemColor: DARK_PALETTE.textSecondary,
        darkItemHoverColor: DARK_PALETTE.textPrimary,
        // Light-mode tokens (consumed when algorithm is defaultAlgorithm)
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        itemHoverBg: p.menuHoverBg,
        itemSelectedBg: p.menuSelectedBg,
        itemSelectedColor: p.menuSelectedText,
        itemColor: p.textSecondary,
        itemHoverColor: p.textPrimary,
        itemBorderRadius: 6,
        itemHeight: 38,
        iconSize: 16,
      },
      Table: {
        headerBg: p.tableHeaderBg,
        headerColor: p.textSecondary,
        headerSplitColor: p.borderSubtle,
        rowHoverBg: p.tableRowHoverBg,
        borderColor: p.borderSubtle,
        cellFontSize: 13,
        cellFontSizeMD: 13,
        cellPaddingBlock: 10,
        cellPaddingInline: 14,
      },
      Button: {
        fontWeight: 500,
        controlHeight: 32,
        paddingInline: 14,
        primaryShadow: 'none',
        defaultBg: 'transparent',
        defaultBorderColor: p.buttonDefaultBorder,
        defaultColor: p.buttonDefaultText,
        defaultHoverBorderColor: BRAND_INDIGO,
        defaultHoverColor: mode === 'dark' ? BRAND_INDIGO_HOVER : BRAND_INDIGO_DEEP,
        defaultHoverBg:
          mode === 'dark' ? 'rgba(91,91,255,0.08)' : 'rgba(91,91,255,0.06)',
      },
      Modal: {
        contentBg: p.bgElevated,
        headerBg: p.bgElevated,
        titleFontSize: 16,
        borderRadiusLG: 14,
      },
      Drawer: {
        colorBgElevated: p.bgContainer,
      },
      Card: {
        colorBgContainer: p.bgContainer,
        headerBg: 'transparent',
        headerFontSize: 14,
        headerFontSizeSM: 13,
        borderRadiusLG: 14,
        paddingLG: 20,
      },
      Input: {
        activeBorderColor: BRAND_INDIGO,
        hoverBorderColor: 'rgba(91,91,255,0.5)',
        colorBgContainer: p.bgInput,
      },
      InputNumber: {
        activeBorderColor: BRAND_INDIGO,
        hoverBorderColor: 'rgba(91,91,255,0.5)',
        colorBgContainer: p.bgInput,
      },
      DatePicker: {
        activeBorderColor: BRAND_INDIGO,
        hoverBorderColor: 'rgba(91,91,255,0.5)',
        colorBgContainer: p.bgInput,
        colorBgElevated: p.bgSpotlight,
      },
      Select: {
        optionSelectedBg: p.menuSelectedBg,
        optionSelectedColor: p.menuSelectedText,
        colorBgContainer: p.bgInput,
        colorBgElevated: p.bgSpotlight,
      },
      Tabs: {
        cardBg: 'transparent',
        itemColor: p.textSecondary,
        itemHoverColor: p.textPrimary,
        itemSelectedColor: p.menuSelectedText,
        inkBarColor: BRAND_INDIGO,
        horizontalMargin: '0 0 16px 0',
        titleFontSize: 14,
      },
      Tooltip: {
        colorBgSpotlight: p.bgSpotlight,
        colorTextLightSolid: p.textPrimary,
      },
      Tag: {
        defaultBg: p.tagDefaultBg,
        defaultColor: p.tagDefaultText,
      },
      Dropdown: {
        colorBgElevated: p.bgSpotlight,
      },
      Divider: {
        colorSplit: p.dividerSplit,
      },
      Form: {
        labelColor: p.textSecondary,
        labelFontSize: 13,
      },
      Segmented: {
        itemSelectedBg: p.segmentedSelectedBg,
        itemSelectedColor: p.segmentedSelectedText,
        trackBg: p.segmentedTrackBg,
      },
      Pagination: {
        itemBg: 'transparent',
        itemActiveBg: p.menuSelectedBg,
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Legacy exports — retained so older imports still compile          */
/* ------------------------------------------------------------------ */

export const adminDarkTheme: ThemeConfig = buildAdminAntdTheme('dark');
export const adminLightTheme: ThemeConfig = buildAdminAntdTheme('light');

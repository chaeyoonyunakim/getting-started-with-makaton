import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const enGB = {
  translation: {
    app: {
      name: "The Makaton",
      tagline: "A communication board for SEND classrooms",
    },
    nav: {
      home: "Home",
      settings: "Settings",
      reviewSymbols: "Review symbols",
      signOut: "Sign out",
    },
    a11y: {
      backHome: "Back to home",
      openSettings: "Open settings",
      selectCard: "Select {{label}}",
      sceneNav: "Scene navigation",
      board: "Choice board",
    },
    settings: {
      title: "Settings",
      depth: "Navigation depth",
      depthHelp: "How many steps a pupil takes to reach a final choice.",
      reduceMotion: "Reduce motion",
      reduceMotionHelp: "Removes animation and large transitions.",
      highContrast: "High contrast",
      highContrastHelp: "Yellow-on-black theme for low-vision users.",
      homeLanguage: "Home language",
      homeLanguageHelp:
        "The language spoken at home. Display only — does not change the interface yet.",
    },
    session: {
      start: "Start session",
      end: "End session",
      goldenSign: "Golden sign earned",
    },
    common: {
      save: "Save",
      cancel: "Cancel",
      loading: "Loading…",
    },
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { "en-GB": enGB, en: enGB },
      fallbackLng: "en-GB",
      supportedLngs: ["en-GB", "en"],
      interpolation: { escapeValue: false },
      detection: { order: ["localStorage", "navigator"] },
    });
}

export default i18n;

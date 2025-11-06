/**
 * Copyright (c) 2025 AspectSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
import * as Localization from "expo-localization";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import el from "@/locales/el.json";
import en from "@/locales/en.json";

const resources = {
  en: { translation: en },
  el: { translation: el }
};

const deviceLocales = Localization.getLocales();
const deviceLang =
  (deviceLocales && deviceLocales.length > 0 && deviceLocales[0].languageCode) || "en";

if (!i18next.isInitialized) {
  i18next
    .use(initReactI18next)
    .init({
      resources,
      lng: deviceLang,
      fallbackLng: "en",
      supportedLngs: ["en", "el"],
      interpolation: { escapeValue: false },
      compatibilityJSON: "v3",
      returnEmptyString: false
    })
    .catch(error => {
      console.warn("i18n init failed:", error);
    });
}

export default i18next;

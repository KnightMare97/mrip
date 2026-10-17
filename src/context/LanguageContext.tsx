import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'fa';
export type Direction = 'ltr' | 'rtl';

interface Translations {
  appName: string;
  demoBadge: string;
  searchPlaceholder: string;
  recentSearches: string;
  clearHistory: string;
  artistsFound: string;
  noArtistsFound: string;
  releases: string;
  all: string;
  albums: string;
  eps: string;
  singles: string;
  live: string;
  disc: string;
  tracks: string;
  totalDuration: string;
  targetFormat: string;
  exportAlbum: string;
  exporting: string;
  recentJobs: string;
  noJobsYet: string;
  status: string;
  artifactStatus: string;
  retry: string;
  cancel: string;
  reviewMatchTitle: string;
  reviewMatchDesc: string;
  acceptCandidate: string;
  excludeTrack: string;
  simulatedArchiveDetails: string;
  fileHierarchy: string;
  id3Tags: string;
  close: string;
  installApp: string;
  installOnIOS: string;
  devPanelTitle: string;
  devPanelSubtitle: string;
  testSuccess: string;
  testMissingTrack: string;
  testAmbiguousMatch: string;
  testServerError: string;
  testExpiredArchive: string;
  interruptedBanner: string;
  offlineBanner: string;
  unknownMetadata: string;
  bonusTrack: string;
  liveRecording: string;
  sourceQuality: string;
  statusQueued: string;
  statusResolving: string;
  statusAwaitingReview: string;
  statusDownloading: string;
  statusTagging: string;
  statusPackaging: string;
  statusCompleted: string;
  statusPartial: string;
  statusFailed: string;
  artifactAvailable: string;
  artifactExpired: string;
  artifactNotCreated: string;
  navSearch: string;
  navLibrary: string;
  navJobs: string;
  navSettings: string;
  archiveNotice: string;
}

const en: Translations = {
  appName: 'Music Rip',
  demoBadge: 'DEMO PROTOTYPE',
  searchPlaceholder: 'Search artists by name, Persian title, or genre...',
  recentSearches: 'Recent Searches',
  clearHistory: 'Clear',
  artistsFound: 'Artists Found',
  noArtistsFound: 'No artists found matching your search.',
  releases: 'Releases',
  all: 'All',
  albums: 'Albums',
  eps: 'EPs',
  singles: 'Singles',
  live: 'Live',
  disc: 'Disc',
  tracks: 'Tracks',
  totalDuration: 'Total Duration',
  targetFormat: 'Target Format',
  exportAlbum: 'Export Album (Demo)',
  exporting: 'Simulating Export...',
  recentJobs: 'Recent Jobs',
  noJobsYet: 'No simulated export jobs yet. Open an album to start an export.',
  status: 'Processing Status',
  artifactStatus: 'Artifact Availability',
  retry: 'Retry Failed Tracks',
  cancel: 'Cancel',
  reviewMatchTitle: 'Ambiguous Track Match Review',
  reviewMatchDesc: 'Multiple candidates found. Select the accurate studio cut or exclude this track from the archive.',
  acceptCandidate: 'Select Candidate',
  excludeTrack: 'Exclude Track',
  simulatedArchiveDetails: 'Simulated Archive Inspector',
  fileHierarchy: 'ZIP Hierarchy & Files',
  id3Tags: 'Embedded ID3 Tags',
  close: 'Close',
  installApp: 'Install App',
  installOnIOS: 'Install on iOS',
  devPanelTitle: 'Developer Simulation Scenarios',
  devPanelSubtitle: 'Quickly trigger test states & edge cases',
  testSuccess: '100% Success (Complete)',
  testMissingTrack: 'Missing Track (Partial 9/10)',
  testAmbiguousMatch: 'Ambiguous Match (Review Modal)',
  testServerError: 'Server Unavailable (503 Error)',
  testExpiredArchive: 'Expired Archive (File Expired)',
  interruptedBanner: 'This simulated job was interrupted by a page reload (local simulation).',
  offlineBanner: 'Offline Mode — Cached application shell is active.',
  unknownMetadata: 'Unknown',
  bonusTrack: 'Bonus',
  liveRecording: 'Live',
  sourceQuality: 'Source Quality',
  statusQueued: 'Queued',
  statusResolving: 'Resolving Streams',
  statusAwaitingReview: 'Awaiting User Review',
  statusDownloading: 'Downloading Tracks',
  statusTagging: 'Tagging ID3v2',
  statusPackaging: 'Packaging ZIP',
  statusCompleted: 'Completed',
  statusPartial: 'Partial Export',
  statusFailed: 'Failed',
  artifactAvailable: 'ZIP Ready (Simulated)',
  artifactExpired: 'ZIP Link Expired',
  artifactNotCreated: 'Pending Packaging',
  navSearch: 'Search',
  navLibrary: 'Artists',
  navJobs: 'Jobs',
  navSettings: 'Demo Settings',
  archiveNotice: 'Notice: This is a frontend demo. No real files are written to disk.'
};

const fa: Translations = {
  appName: 'موزیک ریپ',
  demoBadge: 'نسخه نمایشی (دمو)',
  searchPlaceholder: 'جستجوی هنرمند با نام فارسی، انگلیسی یا سبک...',
  recentSearches: 'جستجوهای اخیر',
  clearHistory: 'پاک‌سازی',
  artistsFound: 'هنرمندان یافت‌شده',
  noArtistsFound: 'هنرمندی مطابق جستجوی شما یافت نشد.',
  releases: 'آثار و آلبوم‌ها',
  all: 'همه',
  albums: 'آلبوم‌ها',
  eps: 'مینی‌آلبوم‌ها (EP)',
  singles: 'تک‌آهنگ‌ها',
  live: 'اجراهای زنده',
  disc: 'دیسک',
  tracks: 'قطعه',
  totalDuration: 'مدت کل',
  targetFormat: 'فرمت خروجی',
  exportAlbum: 'خروجی آلبوم (دمو)',
  exporting: 'شبیه‌سازی خروجی...',
  recentJobs: 'عملیات‌های اخیر',
  noJobsYet: 'هنوز هیچ عملیات خروجی شبیه‌سازی نشده است.',
  status: 'وضعیت پردازش',
  artifactStatus: 'وضعیت فایل آرشیو',
  retry: 'تلاش مجدد قطعات ناموفق',
  cancel: 'انصراف',
  reviewMatchTitle: 'بررسی تطابق غیرقطعی قطعه',
  reviewMatchDesc: 'چندین نسخه مختلف یافت شد. لطفاً نسخه استودیویی اصلی را انتخاب کنید یا این قطعه را کنار بگذارید.',
  acceptCandidate: 'انتخاب این نسخه',
  excludeTrack: 'صرف‌نظر از این قطعه',
  simulatedArchiveDetails: 'بازرس آرشیو شبیه‌سازی‌شده',
  fileHierarchy: 'ساختار پوشه‌ها و فایل‌های ZIP',
  id3Tags: 'متاداده‌های ID3',
  close: 'بستن',
  installApp: 'نصب برنامه',
  installOnIOS: 'راهنمای نصب iOS',
  devPanelTitle: 'سناریوهای شبیه‌سازی توسعه‌دهنده',
  devPanelSubtitle: 'تست سریع حالت‌ها و سناریوهای مرزی',
  testSuccess: 'موفقیت کامل (۱۰۰٪)',
  testMissingTrack: 'قطعه مفقود (ناقص)',
  testAmbiguousMatch: 'تطابق مبهم (دیالوگ بازبینی)',
  testServerError: 'خطای سرور (۵۰۳)',
  testExpiredArchive: 'آرشیو منقضی‌شده',
  interruptedBanner: 'این پردازش با بارگذاری مجدد مرورگر متوقف شد (شبیه‌سازی محلی).',
  offlineBanner: 'حالت آفلاین — پوسته برنامه در دسترس است.',
  unknownMetadata: 'نامشخص',
  bonusTrack: 'قطعه هدیه',
  liveRecording: 'زنده',
  sourceQuality: 'کیفیت مبدا',
  statusQueued: 'در صف انتظار',
  statusResolving: 'بررسی منابع صوت',
  statusAwaitingReview: 'در انتظار تایید کاربر',
  statusDownloading: 'دانلود قطعات',
  statusTagging: 'برچسب‌گذاری ID3',
  statusPackaging: 'بسته‌بندی فایل ZIP',
  statusCompleted: 'تکمیل‌شده',
  statusPartial: 'خروجی ناقص',
  statusFailed: 'ناموفق',
  artifactAvailable: 'فایل ZIP آماده (شبیه‌سازی)',
  artifactExpired: 'لینک منقضی شده',
  artifactNotCreated: 'در انتظار بسته‌بندی',
  navSearch: 'جستجو',
  navLibrary: 'هنرمندان',
  navJobs: 'عملیات‌ها',
  navSettings: 'تنظیمات دمو',
  archiveNotice: 'توجه: این یک پیش‌نمایش رابط کاربری است و هیچ فایلی روی دیسک ذخیره نمی‌شود.'
};

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('musicrip_lang') as Language) || 'en';
  });

  const direction: Direction = language === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('musicrip_lang', language);
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', language);
  }, [language, direction]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'en' ? 'fa' : 'en'));
  };

  const t = language === 'fa' ? fa : en;

  return (
    <LanguageContext.Provider value={{ language, direction, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

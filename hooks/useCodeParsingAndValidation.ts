"use client"

import { useState, useCallback } from 'react';
// Removed direct sonner import import { toast } from 'sonner';
import { useAppToast } from '@/hooks/useAppToast'; // Use toast hook
import { debugLogger as logger } from '@/lib/debugLogger'; // Use logger

// --- Interfaces ---
export interface FileEntry { id: string; path: string; content: string; extension: string; }
export interface ValidationIssue {
    id: string; fileId: string; filePath: string;
    // .. Updated issue types
    type: 'iconLegacy' | 'useClient' | 'import' | 'skippedCodeBlock' | 'skippedComment' | 'parseError' | 'incorrectFa6IconName' | 'unknownFa6IconName';
    message: string;
    details?: any;
    fixable: boolean;
    restorable?: boolean; // For skippedCodeBlock
    severity?: 'error' | 'warning' | 'info'; // Added severity
}
export type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

// --- Constants ---
// .. Legacy react-icons/fa replacements
const legacyIconReplacements: Record<string, string> = {
    'FaSync': 'FaRotate', 'FaTools': 'FaScrewdriverWrench', 'FaCheckSquare': 'FaSquareCheck',
    'FaTelegramPlane': 'FaPaperPlane', 'FaEllipsisV': 'FaEllipsisVertical', 'FaInfoCircle': 'FaCircleInfo',
    'FaTrashAlt': 'FaPoo', // Example: maybe FaTrashCan is better? // [SALAVEY13] No:)
    'FaCheckCircle': 'FaCircleCheck', 'FaTimesCircle': 'FaCircleXmark', // Corrected FaCircleTimes to FaCircleXmark
};
const badIconImportSource = 'react-icons/fa';

// .. New: Map for known Fa6 corrections
const fa6IconCorrectionMap: Record<string, string> = {
    FaExclamationTriangle: 'FaTriangleExclamation',
    FaBalanceScale: 'FaScaleBalanced',
    FaTools: 'FaToolbox',
    FaUserCog: 'FaUserGear',
    FaProjectDiagram: 'FaDiagramProject',
    FaCog: 'FaGear',
    FaUserCircle: 'FaCircleUser',
    FaTimesCircle: 'FaCircleXmark',
    FaMapSigns: 'FaMapLocation',
    FaRunning: 'FaPersonRunning',
    FaSadTear: 'FaFaceSadTear',
    FaSearchDollar: 'FaMagnifyingGlassDollar',
};
const knownIncorrectFa6Names = Object.keys(fa6IconCorrectionMap);

// .. Full list of valid Fa6 icons (shortened)
const validFa6Icons = new Set([
    // Common UI & Actions
    'FaAlignCenter','FaAlignJustify','FaAlignLeft','FaAlignRight','FaAngleDown','FaAngleLeft',
    'FaAngleRight','FaAngleUp','FaAnglesDown','FaAnglesLeft','FaAnglesRight','FaAnglesUp',
    'FaArrowDown','FaArrowLeft','FaArrowPointer','FaArrowRightArrowLeft','FaArrowRightFromBracket',
    'FaArrowRightLong','FaArrowRightToBracket','FaArrowRight','FaArrowRotateLeft','FaArrowRotateRight',
    'FaArrowTrendDown','FaArrowTrendUp','FaArrowTurnDown','FaArrowTurnUp','FaArrowUpFromBracket',
    'FaArrowUpRightFromSquare','FaArrowUp','FaArrowsLeftRight','FaArrowsRotate','FaArrowsSpin',
    'FaArrowsUpDownLeftRight','FaArrowsUpDown','FaArrowsUpToLine','FaAt','FaBackwardFast','FaBackwardStep',
    'FaBackward','FaBan','FaBarsProgress','FaBarsStaggered','FaBars','FaBellSlash','FaBell',
    'FaBolt','FaBookBookmark','FaBookOpenReader','FaBookOpen','FaBook','FaBookmark','FaBoxArchive',
    'FaBoxOpen','FaBox','FaBoxesStacked','FaBrain','FaBriefcase','FaBugSlash','FaBug','FaBuilding',
    'FaBullhorn','FaBullseye','FaBurger','FaBus','FaCalculator','FaCalendarCheck','FaCalendarDay',
    'FaCalendarDays','FaCalendarMinus','FaCalendarPlus','FaCalendarWeek','FaCalendarXmark','FaCalendar',
    'FaCameraRetro','FaCameraRotate','FaCamera','FaCaretDown','FaCaretLeft','FaCaretRight','FaCaretUp',
    'FaCartArrowDown','FaCartPlus','FaCartShopping','FaChartArea','FaChartBar','FaChartColumn','FaChartGantt',
    'FaChartLine','FaChartPie','FaChartSimple','FaCheckDouble','FaCheckToSlot','FaCheck','FaChevronDown',
    'FaChevronLeft','FaChevronRight','FaChevronUp','FaCircleCheck','FaCircleDot','FaCircleDown','FaCircleExclamation',
    'FaCircleHalfStroke','FaCircleInfo','FaCircleLeft','FaCircleMinus','FaCircleNodes','FaCircleNotch',
    'FaCirclePause','FaCirclePlay','FaCirclePlus','FaCircleQuestion','FaCircleRight','FaCircleStop',
    'FaCircleUp','FaCircleUser','FaCircleXmark','FaCircle','FaClipboardCheck','FaClipboardList','FaClipboardQuestion',
    'FaClipboardUser','FaClipboard','FaClockRotateLeft','FaClock','FaClone','FaClosedCaptioning','FaCloudArrowDown',
    'FaCloudArrowUp','FaCloudBolt','FaCloudRain','FaCloudShowersHeavy','FaCloudSunRain','FaCloudSun','FaCloud',
    'FaCodeBranch','FaCodeCommit','FaCodeCompare','FaCodeFork','FaCodeMerge','FaCodePullRequest','FaCode',
    'FaCoins','FaCommentDollar','FaCommentDots','FaCommentMedical','FaCommentSlash','FaCommentSms','FaComment',
    'FaCommentsDollar','FaComments','FaCompassDrafting','FaCompass','FaCompress','FaComputerMouse','FaComputer',
    'FaCopy','FaCopyright','FaCreditCard','FaCropSimple','FaCrop','FaCrosshairs','FaCube','FaCubesStacked',
    'FaCubes','FaDatabase','FaDeleteLeft','FaDesktop','FaDiagramNext','FaDiagramPredecessor','FaDiagramProject',
    'FaDiagramSuccessor','FaDisplay','FaDivide','FaDollarSign','FaDoorClosed','FaDoorOpen','FaDownLeftAndUpRightToCenter',
    'FaDownLong','FaDownload','FaDropletSlash','FaDroplet','FaDumbbell','FaEarDeaf','FaEarListen','FaEject',
    'FaEllipsisVertical','FaEllipsis','FaEnvelopeCircleCheck','FaEnvelopeOpenText','FaEnvelopeOpen','FaEnvelope',
    'FaEnvelopesBulk','FaEquals','FaEraser','FaExclamation','FaExpand','FaEyeDropper','FaEyeLowVision',
    'FaEyeSlash','FaEye','FaFaceAngry','FaFaceDizzy','FaFaceFlushed','FaFaceFrownOpen','FaFaceFrown',
    'FaFaceGrimace','FaFaceGrinBeamSweat','FaFaceGrinBeam','FaFaceGrinHearts','FaFaceGrinSquintTears','FaFaceGrinSquint',
    'FaFaceGrinStars','FaFaceGrinTears','FaFaceGrinTongueSquint','FaFaceGrinTongueWink','FaFaceGrinTongue',
    'FaFaceGrinWide','FaFaceGrinWink','FaFaceGrin','FaFaceKissBeam','FaFaceKissWinkHeart','FaFaceKiss',
    'FaFaceLaughBeam','FaFaceLaughSquint','FaFaceLaughWink','FaFaceLaugh','FaFaceMehBlank','FaFaceMeh',
    'FaFaceRollingEyes','FaFaceSadCry','FaFaceSadTear','FaFaceSmileBeam','FaFaceSmileWink','FaFaceSmile',
    'FaFaceSurprise','FaFaceTired','FaFileArrowDown','FaFileArrowUp','FaFileAudio','FaFileCircleCheck',
    'FaFileCircleExclamation','FaFileCircleMinus','FaFileCirclePlus','FaFileCircleQuestion','FaFileCircleXmark',
    'FaFileCode','FaFileCsv','FaFileExcel','FaFileExport','FaFileImage','FaFileImport','FaFileInvoiceDollar',
    'FaFileInvoice','FaFileLines','FaFileMedical','FaFilePdf','FaFilePen','FaFilePowerpoint','FaFilePrescription',
    'FaFileShield','FaFileSignature','FaFileVideo','FaFileWaveform','FaFileWord','FaFileZipper','FaFile',
    'FaFilm','FaFilterCircleDollar','FaFilterCircleXmark','FaFilter','FaFingerprint','FaFireExtinguisher',
    'FaFireFlameCurved','FaFireFlameSimple','FaFire','FaFlagCheckered','FaFlagUsa','FaFlag','FaFlaskVial','FaFlask',
    'FaFloppyDisk','FaFolderClosed','FaFolderMinus','FaFolderOpen','FaFolderPlus','FaFolderTree','FaFolder',
    'FaFont','FaForwardFast','FaForwardStep','FaForward','FaFutbol','FaGamepad','FaGasPump','FaGaugeHigh',
    'FaGaugeSimpleHigh','FaGaugeSimple','FaGauge','FaGavel','FaGear','FaGears','FaGem','FaGift','FaGifts',
    'FaGlobe','FaGraduationCap','FaGripLinesVertical','FaGripLines','FaGripVertical','FaGrip','FaGroupArrowsRotate',
    'FaGun','FaHammer','FaHandBackFist','FaHandDots','FaHandFist','FaHandHoldingDollar','FaHandHoldingDroplet',
    'FaHandHoldingHand','FaHandHoldingHeart','FaHandHoldingMedical','FaHandHolding','FaHandLizard','FaHandMiddleFinger',
    'FaHandPeace','FaHandPointDown','FaHandPointLeft','FaHandPointRight','FaHandPointUp','FaHandPointer',
    'FaHandScissors','FaHandSparkles','FaHandSpock','FaHand','FaHandshakeAngle','FaHandshakeSimpleSlash',
    'FaHandshakeSimple','FaHandshakeSlash','FaHandshake','FaHardDrive','FaHashtag','FaHeadphonesSimple',
    'FaHeadphones','FaHeadset','FaHeartCircleBolt','FaHeartCircleCheck','FaHeartCircleExclamation','FaHeartCircleMinus',
    'FaHeartCirclePlus','FaHeartCircleXmark','FaHeartCrack','FaHeartPulse','FaHeart','FaHighlighter','FaHistory',
    'FaHome','FaHospitalUser','FaHospital','FaHourglassEnd','FaHourglassHalf','FaHourglassStart','FaHourglass',
    'FaHouseChimney','FaHouseCircleCheck','FaHouseCircleExclamation','FaHouseCircleXmark','FaHouseCrack','FaHouseFire',
    'FaHouseFlag','FaHouseLaptop','FaHouseLock','FaHouseMedical','FaHouseSignal','FaHouseUser','FaHouse',
    'FaICursor','FaImagePortrait','FaImage','FaImages','FaInbox','FaIndent','FaIndustry','FaInfinity','FaInfo',
    'FaItalic','FaKey','FaKeyboard','FaKitMedical','FaLanguage','FaLaptopCode','FaLaptopFile','FaLaptopMedical',
    'FaLaptop','FaLayerGroup','FaLeaf','FaLeftLong','FaLeftRight','FaLemon','FaLifeRing','FaLightbulb',
    'FaLinkSlash','FaLink','FaListCheck','FaListOl','FaListUl','FaList','FaLocationArrow','FaLocationCrosshairs',
    'FaLocationDot','FaLocationPinLock','FaLocationPin','FaLockOpen','FaLock','FaLongArrowAltDown',
    'FaLongArrowAltLeft','FaLongArrowAltRight','FaLongArrowAltUp','FaLowVision',
    'FaMagnet','FaMagnifyingGlassArrowRight','FaMagnifyingGlassChart','FaMagnifyingGlassDollar','FaMagnifyingGlassLocation',
    'FaMagnifyingGlassMinus','FaMagnifyingGlassPlus','FaMagnifyingGlass','FaMapLocationDot','FaMapLocation','FaMapPin',
    'FaMap','FaMarker','FaMedal','FaMemory','FaMessage','FaMicrochip','FaMicrophoneLinesSlash','FaMicrophoneLines',
    'FaMicrophoneSlash','FaMicrophone','FaMicroscope','FaMinimize','FaMinus','FaMobileButton','FaMobileRetro',
    'FaMobileScreenButton','FaMobileScreen','FaMobile','FaMoneyBill1Wave','FaMoneyBill1','FaMoneyBillTransfer',
    'FaMoneyBillTrendUp','FaMoneyBillWave','FaMoneyBill','FaMoneyBills','FaMoneyCheckDollar','FaMoneyCheck',
    'FaMoon','FaMusic','FaNetworkWired','FaNewspaper','FaNoteSticky','FaNotesMedical','FaObjectGroup','FaObjectUngroup',
    'FaOutdent','FaPaintbrush','FaPalette','FaPaperPlane','FaPaperclip','FaParagraph','FaPaste','FaPause','FaPaw',
    'FaPenClip','FaPenFancy','FaPenNib','FaPenRuler','FaPenToSquare','FaPen','FaPencil','FaPeopleArrows',
    'FaPeopleCarryBox','FaPeopleGroup','FaPeopleLine','FaPercent','FaPersonArrowDownToLine','FaPersonArrowUpFromLine',
    'FaPersonBiking','FaPersonBooth','FaPersonChalkboard','FaPersonCircleCheck','FaPersonCircleExclamation',
    'FaPersonCircleMinus','FaPersonCirclePlus','FaPersonCircleQuestion','FaPersonCircleXmark','FaPersonDotsFromLine',
    'FaPersonDress','FaPersonHiking','FaPersonPraying','FaPersonRunning','FaPersonShelter','FaPersonSkating',
    'FaPersonSkiing','FaPersonWalking','FaPerson','FaPhoneFlip','FaPhoneSlash','FaPhoneVolume','FaPhone','FaPhotoFilm',
    'FaPiggyBank','FaPills','FaPlay','FaPlugCircleBolt','FaPlugCircleCheck','FaPlugCircleExclamation',
    'FaPlugCircleMinus','FaPlugCirclePlus','FaPlugCircleXmark','FaPlug','FaPlusMinus','FaPlus','FaPodcast',
    'FaPoo','FaPowerOff','FaPrint','FaPuzzlePiece','FaQrcode','FaQuestion','FaQuoteLeft','FaQuoteRight','FaRadiation',
    'FaRecordVinyl','FaRectangleAd','FaRectangleList','FaRectangleXmark','FaRecycle','FaRegistered','FaRepeat',
    'FaReplyAll','FaReply','FaRetweet','FaRibbon','FaRightFromBracket','FaRightLeft','FaRightLong','FaRightToBracket',
    'FaRoadBarrier','FaRoadBridge','FaRoadCircleCheck','FaRoadCircleExclamation','FaRoadCircleXmark','FaRoadLock',
    'FaRoadSpikes','FaRoad','FaRobot','FaRocket','FaRotateLeft','FaRotateRight','FaRotate','FaRoute','FaRss',
    'FaRulerCombined','FaRulerHorizontal','FaRulerVertical','FaRuler','FaSave',
    'FaScaleBalanced','FaScaleUnbalancedFlip','FaScaleUnbalanced','FaSchool','FaScissors','FaScrewdriverWrench',
    'FaScrewdriver','FaScroll','FaSdCard','FaSearch',
    'FaSearchMinus','FaSearchPlus','FaSection','FaSeedling','FaServer','FaShapes','FaShareFromSquare','FaShareNodes','FaShare',
    'FaShieldAlt','FaShieldHalved','FaShieldVirus','FaShield','FaShip','FaShirt','FaShoePrints','FaShopLock','FaShopSlash','FaShop',
    'FaShower','FaShuffle','FaSignHanging','FaSignal','FaSignature','FaSignsPost','FaSitemap','FaSlidersH',
    'FaSliders','FaSmoking','FaSnowflake','FaSortAlphaDown','FaSortAlphaUp','FaSortAmountDown','FaSortAmountUp',
    'FaSortDown','FaSortNumericDown','FaSortNumericUp','FaSortUp','FaSort','FaSpinner','FaSplotch','FaSprayCanSparkles','FaSprayCan','FaSquareArrowUpRight',
    'FaSquareCaretDown','FaSquareCaretLeft','FaSquareCaretRight','FaSquareCaretUp','FaSquareCheck','FaSquareEnvelope',
    'FaSquareFull','FaSquareH','FaSquareMinus','FaSquareParking','FaSquarePen','FaSquarePhoneFlip','FaSquarePhone',
    'FaSquarePlus','FaSquarePollHorizontal','FaSquarePollVertical','FaSquareRootVariable','FaSquareRss','FaSquareShareNodes',
    'FaSquareUpRight','FaSquareVirus','FaSquareXmark','FaSquare','FaStarHalfStroke','FaStarHalf','FaStar','FaStepBackward',
    'FaStepForward','FaStethoscope','FaStickyNote','FaStop','FaStopwatch20','FaStopwatch','FaStoreSlash','FaStore','FaStreetView','FaStrikethrough','FaSubscript',
    'FaSuitcaseMedical','FaSuitcaseRolling','FaSuitcase','FaSun','FaSuperscript','FaSync',
    'FaSyringe','FaTableCellsLarge','FaTableCells','FaTableColumns','FaTableList','FaTable','FaTabletAlt',
    'FaTabletButton','FaTabletScreenButton','FaTablet','FaTablets','FaTachometerAlt',
    'FaTag','FaTags','FaTasks','FaTaxi','FaTerminal','FaTextHeight','FaTextSlash','FaTextWidth','FaThermometer','FaThumbsDown','FaThumbsUp',
    'FaThumbtack','FaTicketAlt','FaTicketSimple','FaTicket','FaTimes','FaTimeline','FaTint','FaTintSlash',
    'FaToggleOff','FaToggleOn','FaToolbox','FaTools','FaTooth','FaTrashAlt','FaTrashArrowUp','FaTrashCanArrowUp','FaTrashCan','FaTrash','FaTree','FaTriangleExclamation','FaTrophy',
    'FaTruckFast','FaTruckMedical','FaTruckMoving','FaTruckPickup','FaTruck','FaTv','FaUnderline','FaUndo',
    'FaUniversalAccess','FaUniversity','FaUnlockAlt','FaUnlockKeyhole','FaUnlock','FaUnlink','FaUpDownLeftRight','FaUpDown','FaUpLong','FaUpRightAndDownLeftFromCenter','FaUpRightFromSquare','FaUpload',
    'FaUserAlt','FaUserAstronaut','FaUserCheck','FaUserClock','FaUserDoctor','FaUserEdit','FaUserFriends',
    'FaUserGear','FaUserGraduate','FaUserGroup','FaUserInjured','FaUserLargeSlash','FaUserLarge','FaUserLock',
    'FaUserMd','FaUserMinus','FaUserNinja','FaUserNurse','FaUserPen','FaUserPlus','FaUserSecret','FaUserShield','FaUserSlash',
    'FaUserTag','FaUserTie','FaUserTimes','FaUserXmark','FaUser','FaUsersBetweenLines','FaUsersCog',
    'FaUsersGear','FaUsersLine','FaUsersRays','FaUsersRectangle','FaUsersSlash','FaUsersViewfinder','FaUsers',
    'FaUtensils','FaVectorSquare','FaVial','FaVials','FaVideoSlash','FaVideo','FaVolumeDown',
    'FaVolumeHigh','FaVolumeLow','FaVolumeMute','FaVolumeOff','FaVolumeUp','FaVolumeXmark','FaWallet','FaWandMagicSparkles','FaWandMagic','FaWandSparkles','FaWarehouse','FaWater',
    'FaWeightHanging','FaWeightScale','FaWifi','FaWind','FaWindowClose','FaWindowMaximize','FaWindowMinimize','FaWindowRestore','FaWineGlass','FaWrench','FaXRay','FaXmark','FaYenSign',
    'FaRegAddressBook','FaRegAddressCard','FaRegBellSlash','FaRegBell','FaRegBookmark','FaRegBuilding','FaRegCalendarCheck',
    'FaRegCalendarDays','FaRegCalendarMinus','FaRegCalendarPlus','FaRegCalendarXmark','FaRegCalendar','FaRegChartBar',
    'FaRegCheckCircle','FaRegCheckSquare','FaRegCircleCheck','FaRegCircleDot','FaRegCircleDown','FaRegCircleLeft','FaRegCirclePause','FaRegCirclePlay',
    'FaRegCircleQuestion','FaRegCircleRight','FaRegCircleStop','FaRegCircleUp','FaRegCircleUser','FaRegCircleXmark',
    'FaRegCircle','FaRegClipboard','FaRegClock','FaRegClone','FaRegClosedCaptioning','FaRegCommentDots','FaRegComment',
    'FaRegComments','FaRegCompass','FaRegCopy','FaRegCopyright','FaRegCreditCard','FaRegEdit',
    'FaRegEnvelopeOpen','FaRegEnvelope','FaRegEyeSlash','FaRegEye','FaRegFaceAngry','FaRegFaceDizzy','FaRegFaceFlushed',
    'FaRegFaceFrownOpen','FaRegFaceFrown','FaRegFaceGrimace','FaRegFaceGrinBeamSweat','FaRegFaceGrinBeam',
    'FaRegFaceGrinHearts','FaRegFaceGrinSquintTears','FaRegFaceGrinSquint','FaRegFaceGrinStars','FaRegFaceGrinTears',
    'FaRegFaceGrinTongueSquint','FaRegFaceGrinTongueWink','FaRegFaceGrinTongue','FaRegFaceGrinWide','FaRegFaceGrinWink',
    'FaRegFaceGrin','FaRegFaceKissBeam','FaRegFaceKissWinkHeart','FaRegFaceKiss','FaRegFaceLaughBeam','FaRegFaceLaughSquint',
    'FaRegFaceLaughWink','FaRegFaceLaugh','FaRegFaceMehBlank','FaRegFaceMeh','FaRegFaceRollingEyes','FaRegFaceSadCry',
    'FaRegFaceSadTear','FaRegFaceSmileBeam','FaRegFaceSmileWink','FaRegFaceSmile','FaRegFaceSurprise','FaRegFaceTired',
    'FaRegFileAlt','FaRegFileArchive','FaRegFileAudio','FaRegFileCode','FaRegFileExcel','FaRegFileImage','FaRegFileLines','FaRegFilePdf','FaRegFilePowerpoint',
    'FaRegFileVideo','FaRegFileWord','FaRegFileZipper','FaRegFile','FaRegFlag','FaRegFloppyDisk','FaRegFolderClosed',
    'FaRegFolderOpen','FaRegFolder','FaRegFutbol','FaRegGem','FaRegHandLizard','FaRegHandPeace','FaRegHandPointDown',
    'FaRegHandPointLeft','FaRegHandPointRight','FaRegHandPointUp','FaRegHandPointer','FaRegHandScissors','FaRegHandSpock',
    'FaRegHand','FaRegHandshake','FaRegHardDrive','FaRegHeart','FaRegHospital','FaRegHourglass','FaRegIdBadge',
    'FaRegIdCard','FaRegImage','FaRegImages','FaRegKeyboard','FaRegLemon','FaRegLifeRing','FaRegLightbulb','FaRegListAlt',
    'FaRegMap','FaRegMeh','FaRegMessage','FaRegMoneyBill1','FaRegMoon','FaRegNewspaper','FaRegNoteSticky','FaRegObjectGroup','FaRegObjectUngroup',
    'FaRegPaperPlane','FaRegPaste','FaRegPauseCircle','FaRegPenToSquare','FaRegPlayCircle','FaRegQuestionCircle','FaRegRectangleList','FaRegRectangleXmark','FaRegRegistered','FaRegSave',
    'FaRegShareFromSquare','FaRegSmile','FaRegSmileBeam','FaRegSmileWink','FaRegSnowflake','FaRegSquareCaretDown','FaRegSquareCaretLeft','FaRegSquareCaretRight','FaRegSquareCaretUp',
    'FaRegSquareCheck','FaRegSquareFull','FaRegSquareMinus','FaRegSquarePlus','FaRegSquare','FaRegStarHalfStroke',
    'FaRegStarHalf','FaRegStar','FaRegStopCircle','FaRegSun','FaRegThumbsDown','FaRegThumbsUp','FaRegTimesCircle','FaRegTrashAlt','FaRegTrashCan','FaRegUserCircle','FaRegUser','FaRegWindowMaximize','FaRegWindowMinimize','FaRegWindowRestore',
]);

const importChecks = [
    { name: 'motion', usageRegex: /<motion\./, importRegex: /import .* from ['"]framer-motion['"]/, importStatement: `import { motion } from "framer-motion";` },
    { name: 'clsx', usageRegex: /clsx\(/, importRegex: /import clsx from ['"]clsx['"]/, importStatement: `import clsx from "clsx";` },
    { name: 'React', usageRegex: /React\.(useState|useEffect|useRef|useContext|useCallback|useMemo|Fragment|createElement)/, importRegex: /import\s+(\*\s+as\s+React|React(?:,\s*\{[^}]*\})?)\s+from\s+['"]react['"]/, importStatement: `import React from "react";` }
];
const clientHookPatterns = /(useState|useEffect|useRef|useContext|useReducer|useCallback|useMemo|useLayoutEffect|useImperativeHandle|useDebugValue)\s*\(/;

const skippedCodeBlockMarkerRegex = /(\/\*\s*\.{3}\s*\*\/)|({\s*\/\*\s*\.{3}\s*\*\/\s*})|(\[\s*\/\*\s*\.{3}\s*\*\/\s*\])/;
const skippedCommentKeepRegex = /\/\/\s*\.{3}\s*\(keep\s/;
const skippedCommentRealRegex = /\/\/\s*\.{3}(?!\s*\()/;
const codeBlockStartRegex = /^\s*```(\w*)\s*$/;
const codeBlockEndRegex = /^\s*```\s*$/;
const pathCommentRegex = /^\s*(?:\/\/|\/\*|--|#)\s*([\w\-\/\.\[\]]+?\.\w+)/;

const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

// --- Custom Hook ---
export function useCodeParsingAndValidation() {
    logger.debug("[useCodeParsingAndValidation] Hook initialized");
    const { success: toastSuccess, error: toastError, info: toastInfo, warning: toastWarning } = useAppToast(); // Use toast hook
    const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
    const [rawDescription, setRawDescription] = useState<string>("");
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    const parseFilesFromText = useCallback((text: string): { files: FileEntry[], description: string, parseErrors: ValidationIssue[] } => {
        logger.debug("[Parse Logic] Starting parseFilesFromText");
        const files: FileEntry[] = [];
        const parseErrors: ValidationIssue[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([\w\-\/\.\[\]]+?\.\w+)\s*(?:\*\/)?\s*$)\n*)?^\s*```(\w+)?\n([\s\S]*?)\n^\s*```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([\w\-\/\.\[\]]+?\.\w+)\s*(?:\*\/)?\s*$))?/gm;
        let match;
        let fileCounter = 0;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            fileCounter++;
            const currentMatchIndex = match.index;
            if (currentMatchIndex > lastIndex) {
                descriptionParts.push(text.substring(lastIndex, currentMatchIndex).trim());
            }
            lastIndex = codeBlockRegex.lastIndex;

            let path = (match[1] || match[4] || `unnamed-${fileCounter}`).trim();
            let content = match[3].trim();
            let lang = match[2] || '';
            let extension = path.split('.').pop()?.toLowerCase() || lang || 'txt';

            if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0]?.trimStart();
                if (potentialPathLine) {
                    const pathMatch = potentialPathLine.match(pathCommentRegex);
                    if (pathMatch && pathMatch[1]) {
                        path = pathMatch[1].trim();
                        content = lines.slice(1).join('\n').trim();
                        extension = path.split('.').pop()?.toLowerCase() || lang || 'txt';
                         logger.debug(`[Parse Logic] Extracted path "${path}" from comment.`);
                    }
                }
            }
            if (path !== '/') path = path.replace(/^[\/\\]+/, '');

            if (content.includes('```')) {
                 const fileId = generateId();
                 logger.warn(`[Parse Logic] Nested code block detected in potential file: ${path}. Adding parse error.`);
                 parseErrors.push({ id: generateId(), fileId: fileId, filePath: path || `parse-error-${fileId}`, type: 'parseError', message: `Обнаружен вложенный блок кода (\`\`\`). Разбор может быть некорректным.`, details: { lineNumber: -1 }, fixable: false, restorable: false, severity: 'error' });
            }
            files.push({ id: generateId(), path, content, extension });
             logger.debug(`[Parse Logic] Parsed file ${fileCounter}: Path=${path}, Ext=${extension}, Content Length=${content.length}`);
        }
        if (lastIndex < text.length) { descriptionParts.push(text.substring(lastIndex).trim()); }
        const description = descriptionParts.filter(Boolean).join('\n\n');
         logger.debug(`[Parse Logic] Finished parsing. Files: ${files.length}, Errors: ${parseErrors.length}, Desc Length: ${description.length}`);
        return { files, description, parseErrors };
    }, [logger]); // Added logger dependency


    // --- Validation Logic ---
    const validateParsedFiles = useCallback(async (filesToValidate: FileEntry[]): Promise<ValidationIssue[]> => {
        logger.debug("[Validation Logic] Starting validateParsedFiles");
        setValidationStatus('validating');
        const issues: ValidationIssue[] = [];

        for (const file of filesToValidate) {
            if (file.path.startsWith('unnamed-') || file.path.startsWith('parse-error-')) {
                logger.debug(`[Validation Logic] Skipping validation for placeholder file: ${file.path}`);
                continue;
            }
            logger.debug(`[Validation Logic] Validating file: ${file.path}`);
            const lines = file.content.split('\n');
            const fileId = file.id;
            const filePath = file.path;

            // .. 1. Legacy Icon Check
             logger.debug(`[Validation Logic - ${filePath}] Checking for legacy icons...`);
            const legacyIconImportRegex = /import\s+{([^}]*)}\s+from\s+['"]react-icons\/fa['"]/g;
            let legacyImportMatch;
            while ((legacyImportMatch = legacyIconImportRegex.exec(file.content)) !== null) {
                const legacyImportLineNumber = file.content.substring(0, legacyImportMatch.index).split('\n').length;
                const legacyImportedIcons = legacyImportMatch[1].split(',').map(i => i.trim().split(/\s+as\s+/)[0]).filter(Boolean);
                logger.debug(`[Validation Logic - ${filePath}] Found legacy import line ${legacyImportLineNumber}: ${legacyImportedIcons.join(', ')}`);
                legacyImportedIcons.forEach(iconName => {
                    const replacement = legacyIconReplacements[iconName];
                    const usageRegex = new RegExp(`<${iconName}(?![-_a-zA-Z0-9])(\\s|\\/?>)`);
                    if (usageRegex.test(file.content)) {
                         logger.warn(`[Validation Logic - ${filePath}] Found legacy icon usage: ${iconName}${replacement ? ` (Replace with ${replacement})` : ''}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'iconLegacy', message: `Legacy icon ${iconName} from 'react-icons/fa'. ${replacement ? `Replace with ${replacement} from /fa6?` : 'Replace?'}`, details: { badIcon: iconName, goodIcon: replacement, lineNumber: legacyImportLineNumber }, fixable: !!replacement, severity: 'warning' });
                     }
                });
            }

             // .. 2. Fa6 Icon Checks
              logger.debug(`[Validation Logic - ${filePath}] Checking for Fa6 icons...`);
             const fa6ImportRegex = /import\s+{([^}]+)}\s+from\s+['"]react-icons\/fa6['"];?/g;
             let fa6Match;
             while ((fa6Match = fa6ImportRegex.exec(file.content)) !== null) {
                 const importList = fa6Match[1];
                 const importLineNumber = file.content.substring(0, fa6Match.index).split('\n').length;
                 const importedFa6IconsRaw = importList.split(',').map(i => i.trim()).filter(Boolean);
                  logger.debug(`[Validation Logic - ${filePath}] Found Fa6 import line ${importLineNumber}: ${importedFa6IconsRaw.join(', ')}`);

                 importedFa6IconsRaw.forEach(rawImport => {
                     const iconName = rawImport.split(/\s+as\s+/)[0].trim();
                     if (!iconName) return;

                     if (knownIncorrectFa6Names.includes(iconName)) {
                         const correctName = fa6IconCorrectionMap[iconName];
                         logger.warn(`[Validation Logic - ${filePath}] Found incorrect Fa6 icon name: ${iconName} -> ${correctName}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'incorrectFa6IconName', message: `Некорректное имя иконки: '${iconName}'. Исправить на '${correctName}'?`, details: { lineNumber: importLineNumber, incorrectName: iconName, correctName: correctName, importStatement: fa6Match[0] }, fixable: true, severity: 'warning' });
                     }
                     else if (!validFa6Icons.has(iconName)) {
                         logger.error(`[Validation Logic - ${filePath}] Found unknown/invalid Fa6 icon name: ${iconName}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'unknownFa6IconName', message: `Неизвестная/несуществующая иконка Fa6: '${iconName}'. Проверьте имя или замените.`, details: { lineNumber: importLineNumber, unknownName: iconName, importStatement: fa6Match[0] }, fixable: false, severity: 'error' });
                     }
                 });
             }


            // .. 3. "use client" Check
             logger.debug(`[Validation Logic - ${filePath}] Checking for "use client"...`);
            if (/\.(tsx|jsx)$/.test(filePath)) {
                 const firstRealLineIndex = lines.findIndex(line => line.trim() !== '');
                 const firstRealLine = firstRealLineIndex !== -1 ? lines[firstRealLineIndex].trim() : null;
                 const hasUseClient = firstRealLine === '"use client";' || firstRealLine === "'use client';";
                 const usesClientFeatures = clientHookPatterns.test(file.content) || /on[A-Z][a-zA-Z]*\s*=\s*{/.test(file.content);
                 logger.debug(`[Validation Logic - ${filePath}] useClient check: hasDirective=${hasUseClient}, usesFeatures=${usesClientFeatures}`);

                 if (!hasUseClient && usesClientFeatures) {
                      let firstUsageLine = -1;
                      const hookMatch = clientHookPatterns.exec(file.content);
                      const eventMatch = /on[A-Z][a-zA-Z]*\s*=\s*{/.exec(file.content);
                      if (hookMatch || eventMatch) {
                          const searchIndex = Math.min(hookMatch?.index ?? Infinity, eventMatch?.index ?? Infinity);
                          if (searchIndex !== Infinity) { firstUsageLine = (file.content.substring(0, searchIndex).match(/\n/g) || []).length + 1; }
                      }
                      const featureName = hookMatch?.[1] ?? (eventMatch ? 'event handler' : 'client feature');
                      logger.warn(`[Validation Logic - ${filePath}] Missing "use client" detected. First usage: ${featureName} around line ${firstUsageLine}`);
                     issues.push({ id: generateId(), fileId, filePath, type: 'useClient', message: `Found ${featureName} without "use client".`, details: { lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined }, fixable: true, severity: 'warning' });
                 }
             }

            // .. 4. Skipped Code Block Check
             logger.debug(`[Validation Logic - ${filePath}] Checking for skipped code blocks...`);
            for (let i = 0; i < lines.length; i++) {
                if (skippedCodeBlockMarkerRegex.test(lines[i].trimStart())) {
                    logger.warn(`[Validation Logic - ${filePath}] Found skipped code block at line ${i + 1}`);
                    issues.push({ id: generateId(), fileId, filePath, type: 'skippedCodeBlock', message: `Skipped code block (line ${i + 1}). Can attempt restore.`, details: { markerLineContent: lines[i], lineNumber: i + 1 }, fixable: false, restorable: true, severity: 'warning' });
                }
            }

            // .. 5. Skipped Comment Check
             logger.debug(`[Validation Logic - ${filePath}] Checking for skipped comments...`);
            for (let i = 0; i < lines.length; i++) {
                const trimmedLine = lines[i].trimStart();
                if (skippedCommentRealRegex.test(trimmedLine) && !skippedCommentKeepRegex.test(trimmedLine)) {
                     logger.warn(`[Validation Logic - ${filePath}] Found skipped comment at line ${i + 1}`);
                     issues.push({ id: generateId(), fileId, filePath, type: 'skippedComment', message: `Skipped comment '// ..''.' (line ${i + 1}). Needs manual review.`, details: { lineNumber: i + 1 }, fixable: false, restorable: false, severity: 'warning' });
                 }
            }

            // .. 6. Import Checks
             logger.debug(`[Validation Logic - ${filePath}] Checking for missing imports...`);
            if (/\.(tsx|jsx)$/.test(filePath)) {
                importChecks.forEach(check => {
                    if (check.usageRegex.test(file.content) && !check.importRegex.test(file.content)) {
                         let firstUsageLine = -1;
                         const usageMatch = check.usageRegex.exec(file.content);
                         if (usageMatch) { firstUsageLine = (file.content.substring(0, usageMatch.index).match(/\n/g) || []).length + 1; }
                         logger.warn(`[Validation Logic - ${filePath}] Missing import detected: ${check.name} used around line ${firstUsageLine}`);
                         issues.push({ id: generateId(), fileId, filePath, type: 'import', message: `Using '${check.name}' but import is missing.`, details: { name: check.name, importStatement: check.importStatement, lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined }, fixable: true, severity: 'warning' });
                    }
                });
            }
             logger.debug(`[Validation Logic] Finished validating file: ${filePath}. Issues found: ${issues.filter(i => i.filePath === filePath).length}`);
        } // End loop through files

        setValidationIssues(issues);
        if (issues.length > 0) {
            const hasErrors = issues.some(issue => issue.severity === 'error');
            const hasWarnings = issues.some(issue => issue.severity === 'warning');
            const finalStatus = hasErrors ? 'error' : (hasWarnings ? 'warning' : 'success'); // Status reflects highest severity
             logger.info(`[Validation Logic] Validation finished. Total issues: ${issues.length}. Status set to: ${finalStatus}`);
            setValidationStatus(finalStatus);
        } else {
             logger.info("[Validation Logic] Validation finished. No issues found. Status: success");
            setValidationStatus('success');
        }
        return issues;
    }, [logger]); // Added logger dependency


     const parseAndValidateResponse = useCallback(async (response: string) => {
        logger.info("[Parse/Validate Trigger] Starting parseAndValidateResponse...");
        setIsParsing(true); setValidationStatus('idle'); setValidationIssues([]); setParsedFiles([]); setRawDescription("");
        if (!response.trim()) {
            toastInfo("Поле ответа пусто.");
            setIsParsing(false);
            logger.warn("[Parse/Validate Trigger] Aborted: Empty response field.");
            return { files: [], description: "", issues: [] };
         }

        try {
            const { files, description, parseErrors } = parseFilesFromText(response);
            setParsedFiles(files); setRawDescription(description);
            let validationIssuesResult: ValidationIssue[] = [];
            if (files.length > 0) {
                toastInfo(`${files.length} файлов найдено. Запуск проверки...`, { duration: 1500 });
                validationIssuesResult = await validateParsedFiles(files);
            } else {
                toastInfo("В ответе не найдено файлов кода для разбора.");
                setValidationStatus('idle');
                 logger.info("[Parse/Validate Trigger] No code files found in the response.");
            }

            const allIssues = [...parseErrors, ...validationIssuesResult];
            setValidationIssues(allIssues);
             logger.info(`[Parse/Validate Trigger] Combined issues: ${allIssues.length} (Parse: ${parseErrors.length}, Validation: ${validationIssuesResult.length})`);

            if (allIssues.length > 0) {
                const hasErrors = allIssues.some(issue => issue.severity === 'error');
                const hasWarnings = allIssues.some(issue => issue.severity === 'warning');
                const finalStatus = hasErrors ? 'error' : (hasWarnings ? 'warning' : 'success');
                setValidationStatus(finalStatus);
                 logger.info(`[Parse/Validate Trigger] Issues found. Final validation status: ${finalStatus}`);
            } else if (files.length > 0) {
                setValidationStatus('success');
                 logger.info("[Parse/Validate Trigger] No issues found. Final validation status: success");
            } else {
                setValidationStatus('idle');
                 logger.info("[Parse/Validate Trigger] No files and no issues. Final validation status: idle");
            }
            setIsParsing(false);
             logger.info("[Parse/Validate Trigger] Finished parseAndValidateResponse.");
            return { files, description, issues: allIssues };
         } catch (error) {
             logger.error("[Parse/Validate Trigger] Critical error during parsing/validation:", error);
             toastError("Критическая ошибка при разборе ответа.");
             setIsParsing(false); setValidationStatus('error');
             const genericError: ValidationIssue = { id: generateId(), fileId: 'general', filePath: 'N/A', type: 'parseError', message: `Критическая ошибка разбора: ${error instanceof Error ? error.message : String(error)}`, details: null, fixable: false, restorable: false, severity: 'error' };
             setValidationIssues([genericError]);
             return { files: [], description: rawDescription, issues: [genericError] };
         }
    }, [parseFilesFromText, validateParsedFiles, rawDescription, toastInfo, toastError, logger]); // Added logger


    // --- Auto-Fixing Logic ---
    const autoFixIssues = useCallback((filesToFix: FileEntry[], issuesToFix: ValidationIssue[]): FileEntry[] => {
         logger.info("[AutoFix Logic] Starting autoFixIssues...");
        let changesMadeCount = 0; const fixedMessages: string[] = [];
        const fixableIssues = issuesToFix.filter(issue => issue.fixable);

        if (fixableIssues.length === 0) {
             toastInfo("Не найдено проблем для автоматического исправления.");
              logger.info("[AutoFix Logic] No fixable issues found.");
             return filesToFix;
        }
         logger.debug(`[AutoFix Logic] Found ${fixableIssues.length} potentially fixable issues.`);

        const updatedFilesMap = new Map(filesToFix.map(f => [f.id, f.content]));

        filesToFix.forEach(file => {
            let currentContent = updatedFilesMap.get(file.id) ?? file.content;
            let fileChanged = false;
            const fileIssues = fixableIssues.filter(issue => issue.fileId === file.id);
             logger.debug(`[AutoFix Logic - ${file.path}] Processing ${fileIssues.length} fixable issues.`);
            if (fileIssues.length === 0) return;

            fileIssues.forEach(issue => {
                try {
                     logger.debug(`[AutoFix Logic - ${file.path}] Attempting to fix issue type: ${issue.type}`);
                    let contentBeforeFix = currentContent;
                    // .. 1. NEW: Fix incorrect Fa6 icon names
                    if (issue.type === 'incorrectFa6IconName' && issue.details?.incorrectName && issue.details?.correctName && issue.details?.importStatement) {
                         const incorrectName = issue.details.incorrectName; const correctName = issue.details.correctName; const importLine = issue.details.importStatement; const lines = currentContent.split('\n'); const importLineIndex = lines.findIndex(line => line.includes(importLine));
                         if (importLineIndex !== -1) {
                             const nameRegex = new RegExp(`\\b${incorrectName}\\b`, 'g'); const originalLine = lines[importLineIndex]; const modifiedLine = originalLine.replace(nameRegex, correctName);
                             if (modifiedLine !== originalLine) { lines[importLineIndex] = modifiedLine; currentContent = lines.join('\n'); fixedMessages.push(`✅ Fa6 Иконка: ${incorrectName} -> ${correctName} в ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Fixed Fa6 icon: ${incorrectName} -> ${correctName}`); }
                             else { logger.warn(`[AutoFix Logic - ${file.path}] Fa6 icon regex did not match: ${incorrectName} in "${originalLine}"`); }
                         } else { logger.warn(`[AutoFix Logic - ${file.path}] Could not find Fa6 import line: "${importLine}"`); }
                    // .. 2. Fix legacy icons
                    } else if (issue.type === 'iconLegacy' && issue.details?.badIcon && issue.details?.goodIcon) {
                        const bad = issue.details.badIcon; const good = issue.details.goodIcon; const usageOpenRegex = new RegExp(`<${bad}(?![-_a-zA-Z0-9])(\\s|\\/?>)`, 'g'); const usageCloseRegex = new RegExp(`</${bad}>`, 'g'); const lines = currentContent.split('\n'); let changedInLegacyFix = false;
                        const newLines = lines.map(line => { if (!line.trim().startsWith('//') && !line.trim().startsWith('/*') && (usageOpenRegex.test(line) || usageCloseRegex.test(line))) { changedInLegacyFix = true; let newLine = line.replace(usageOpenRegex, `<${good}$1`); newLine = newLine.replace(usageCloseRegex, `</${good}>`); return newLine; } return line; });
                        if (changedInLegacyFix) { currentContent = newLines.join('\n'); fixedMessages.push(`✅ Legacy Icon: ${bad} -> ${good} в ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Fixed Legacy icon: ${bad} -> ${good}`);
                            const importRegexFa = new RegExp(`(import\\s+{[^}]*}\\s+from\\s+['"]react-icons/fa['"])`);
                            if (importRegexFa.test(currentContent)) { currentContent = currentContent.replace(importRegexFa, `$1;\n// TODO: Consider changing import to 'react-icons/fa6' for ${good}`); }
                         }
                    // .. 3. Fix "use client"
                    } else if (issue.type === 'useClient') {
                        const lines = currentContent.split('\n'); let firstCodeLineIndex = -1;
                        for (let i = 0; i < lines.length; i++) { const trimmedLine = lines[i].trim(); if (trimmedLine !== '' && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) { firstCodeLineIndex = i; break; } }
                        const alreadyHasUseClient = firstCodeLineIndex !== -1 && (lines[firstCodeLineIndex] === '"use client";' || lines[firstCodeLineIndex] === "'use client';");
                        if (!alreadyHasUseClient) { const insertIndex = firstCodeLineIndex !== -1 ? firstCodeLineIndex : 0; const newLineChar = insertIndex === 0 || (firstCodeLineIndex !== -1 && lines[insertIndex].trim() !== '') ? '\n' : ''; lines.splice(insertIndex, 0, '"use client";' + newLineChar); currentContent = lines.join('\n'); fixedMessages.push(`✅ Added "use client"; to ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Added "use client"`); }
                    // .. 4. Fix missing imports
                    } else if (issue.type === 'import' && issue.details?.importStatement && issue.details?.importRegex) {
                        const importRegex: RegExp = issue.details.importRegex;
                        if (!importRegex.test(currentContent)) {
                            const lines = currentContent.split('\n'); let insertIndex = 0; let useClientIndex = -1;
                             for (let i = 0; i < lines.length; i++) { const tl = lines[i].trim(); if (tl === '"use client";' || tl === "'use client';") { useClientIndex = i; insertIndex = i + 1; } else if (tl.startsWith('import ')) { insertIndex = i + 1; } else if (tl !== '' && !tl.startsWith('//') && !tl.startsWith('/*')) { if (insertIndex === 0 && useClientIndex === -1) insertIndex = 0; break; } }
                             const prefixNewLine = (useClientIndex !== -1 || insertIndex > 0) && lines[insertIndex]?.trim() !== '' ? '\n' : '';
                             lines.splice(insertIndex, 0, prefixNewLine + issue.details.importStatement); currentContent = lines.join('\n'); fixedMessages.push(`✅ Added import for '${issue.details.name}' to ${file.path}`); logger.debug(`[AutoFix Logic - ${file.path}] Added import for ${issue.details.name}`);
                        }
                    }

                     if (contentBeforeFix !== currentContent) { fileChanged = true; }

                 } catch (fixError) {
                      logger.error(`[AutoFix Logic - ${file.path}] Error auto-fixing issue ${issue.id} (${issue.type}):`, fixError);
                      toastError(`Ошибка исправления ${issue.type} в ${file.path}`);
                 }
            }); // End forEach issue in file

            if (fileChanged) {
                 logger.debug(`[AutoFix Logic - ${file.path}] Content updated.`);
                 updatedFilesMap.set(file.id, currentContent);
                 changesMadeCount++;
            } else {
                 logger.debug(`[AutoFix Logic - ${file.path}] No changes made for fixable issues.`);
            }
        }); // End map through filesToFix

        // --- Final Update and Re-validation ---
        if (changesMadeCount > 0) {
             logger.info(`[AutoFix Logic] ${changesMadeCount} file(s) updated. Re-validating...`);
            const updatedFilesArray = filesToFix.map(f => ({ ...f, content: updatedFilesMap.get(f.id) ?? f.content }));
            setParsedFiles(updatedFilesArray);
            fixedMessages.forEach(msg => toastSuccess(msg, { duration: 4000 }));
            validateParsedFiles(updatedFilesArray); // Re-validate AFTER fixing
            return updatedFilesArray;
        } else {
            if (fixableIssues.length > 0) {
                 toastWarning("Авто-исправление было запущено, но не внесло изменений. Возможно, проблемы уже исправлены или логика фиксации нуждается в проверке.");
                  logger.warn("[AutoFix Logic] Autofix ran but made no changes despite fixable issues.");
            } else {
                 logger.info("[AutoFix Logic] No changes made (no fixable issues to address).");
            }
            const nonFixableOrRestorable = validationIssues.some(i => !i.fixable && !i.restorable);
            if (validationStatus === 'warning' && !nonFixableOrRestorable) {
                logger.info("[AutoFix Logic] All remaining issues are restorable/informational, setting status to success.");
                setValidationStatus('success');
            }
            return filesToFix;
        }
    }, [validationIssues, validationStatus, validateParsedFiles, setParsedFiles, toastInfo, toastSuccess, toastError, toastWarning, logger]); // Added logger


     logger.debug("[useCodeParsingAndValidation] Hook setup complete.");
    return {
        parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
        parseAndValidateResponse, autoFixIssues,
        setParsedFiles, setValidationStatus, setValidationIssues, setIsParsing, setRawDescription, // Expose setters if needed externally
    };
}
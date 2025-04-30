"use client"

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

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
    FaTools: 'FaToolbox', // Corrected: FaToolbox is in the list
    FaUserCog: 'FaUserGear',
    FaProjectDiagram: 'FaDiagramProject',
    FaCog: 'FaGear', // Added common error
    FaUserCircle: 'FaCircleUser', // Added common error
    FaTimesCircle: 'FaCircleXmark', // Corrected target name
    FaMapSigns: 'FaMapLocation', // Example from instructions
    // Add more known typos/errors here if discovered
    FaRunning: 'FaPersonRunning',
    FaSadTear: 'FaFaceSadTear',
    FaSearchDollar: 'FaMagnifyingGlassDollar',
};
const knownIncorrectFa6Names = Object.keys(fa6IconCorrectionMap);

// .. Full list of valid Fa6 icons (critical for unknown check) - shortened for brevity in // .. Shortened, more relevant list of valid Fa6 icons
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
    'FaHeartCirclePlus','FaHeartCircleXmark','FaHeartCrack','FaHeartPulse','FaHeart','FaHighlighter','FaHistory', // Kept FaHistory
    'FaHome', // Assuming FaHouse equivalent
    'FaHospitalUser','FaHospital','FaHourglassEnd','FaHourglassHalf','FaHourglassStart','FaHourglass',
    'FaHouseChimney','FaHouseCircleCheck','FaHouseCircleExclamation','FaHouseCircleXmark','FaHouseCrack','FaHouseFire',
    'FaHouseFlag','FaHouseLaptop','FaHouseLock','FaHouseMedical','FaHouseSignal','FaHouseUser','FaHouse',
    'FaICursor','FaImagePortrait','FaImage','FaImages','FaInbox','FaIndent','FaIndustry','FaInfinity','FaInfo',
    'FaItalic','FaKey','FaKeyboard','FaKitMedical','FaLanguage','FaLaptopCode','FaLaptopFile','FaLaptopMedical',
    'FaLaptop','FaLayerGroup','FaLeaf','FaLeftLong','FaLeftRight','FaLemon','FaLifeRing','FaLightbulb',
    'FaLinkSlash','FaLink','FaListCheck','FaListOl','FaListUl','FaList','FaLocationArrow','FaLocationCrosshairs',
    'FaLocationDot','FaLocationPinLock','FaLocationPin','FaLockOpen','FaLock','FaLongArrowAltDown', // Example renaming if needed
    'FaLongArrowAltLeft','FaLongArrowAltRight','FaLongArrowAltUp','FaLowVision', // Example renaming if needed
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
    'FaRulerCombined','FaRulerHorizontal','FaRulerVertical','FaRuler','FaSave', // Assuming FaFloppyDisk equiv
    'FaScaleBalanced','FaScaleUnbalancedFlip','FaScaleUnbalanced','FaSchool','FaScissors','FaScrewdriverWrench',
    'FaScrewdriver','FaScroll','FaSdCard','FaSearch', // Assuming FaMagnifyingGlass equiv
    'FaSearchMinus', // Assuming FaMagnifyingGlassMinus equiv
    'FaSearchPlus', // Assuming FaMagnifyingGlassPlus equiv
    'FaSection','FaSeedling','FaServer','FaShapes','FaShareFromSquare','FaShareNodes','FaShare','FaShieldAlt', // Assuming FaShieldHalved equiv
    'FaShieldHalved','FaShieldVirus','FaShield','FaShip','FaShirt','FaShoePrints','FaShopLock','FaShopSlash','FaShop',
    'FaShower','FaShuffle','FaSignHanging','FaSignal','FaSignature','FaSignsPost','FaSitemap','FaSlidersH', // Assuming FaSliders equiv
    'FaSliders','FaSmoking','FaSnowflake','FaSortAlphaDown', // Assuming FaArrowDownAZ equiv
    'FaSortAlphaUp', // Assuming FaArrowUpAZ equiv
    'FaSortAmountDown', // Assuming FaArrowDownWideShort equiv
    'FaSortAmountUp', // Assuming FaArrowUpWideShort equiv
    'FaSortDown','FaSortNumericDown', // Assuming FaArrowDown19 equiv
    'FaSortNumericUp', // Assuming FaArrowUp19 equiv
    'FaSortUp','FaSort','FaSpinner','FaSplotch','FaSprayCanSparkles','FaSprayCan','FaSquareArrowUpRight',
    'FaSquareCaretDown','FaSquareCaretLeft','FaSquareCaretRight','FaSquareCaretUp','FaSquareCheck','FaSquareEnvelope',
    'FaSquareFull','FaSquareH','FaSquareMinus','FaSquareParking','FaSquarePen','FaSquarePhoneFlip','FaSquarePhone',
    'FaSquarePlus','FaSquarePollHorizontal','FaSquarePollVertical','FaSquareRootVariable','FaSquareRss','FaSquareShareNodes',
    'FaSquareUpRight','FaSquareVirus','FaSquareXmark','FaSquare','FaStarHalfStroke','FaStarHalf','FaStar','FaStepBackward', // Assuming FaBackwardStep equiv
    'FaStepForward', // Assuming FaForwardStep equiv
    'FaStethoscope','FaStickyNote', // Assuming FaNoteSticky equiv
    'FaStop','FaStopwatch20','FaStopwatch','FaStoreSlash','FaStore','FaStreetView','FaStrikethrough','FaSubscript',
    'FaSuitcaseMedical','FaSuitcaseRolling','FaSuitcase','FaSun','FaSuperscript','FaSync', // Assuming FaRotate equiv
    'FaSyringe','FaTableCellsLarge','FaTableCells','FaTableColumns','FaTableList','FaTable','FaTabletAlt', // Assuming FaTablet equiv
    'FaTabletButton','FaTabletScreenButton','FaTablet','FaTablets','FaTachometerAlt', // Assuming FaGauge equiv
    'FaTag','FaTags','FaTasks', // Assuming FaListCheck equiv
    'FaTaxi','FaTerminal','FaTextHeight','FaTextSlash','FaTextWidth','FaThermometer','FaThumbsDown','FaThumbsUp',
    'FaThumbtack','FaTicketAlt', // Assuming FaTicket equiv
    'FaTicketSimple','FaTicket','FaTimes', // Assuming FaXmark equiv
    'FaTimeline','FaTint', // Assuming FaDroplet equiv
    'FaTintSlash', // Assuming FaDropletSlash equiv
    'FaToggleOff','FaToggleOn','FaToolbox','FaTools', // Keeping FaTools temporarily if used, prefer FaToolbox
    'FaTooth','FaTrashAlt', // Assuming FaTrashCan equiv
    'FaTrashArrowUp','FaTrashCanArrowUp','FaTrashCan','FaTrash','FaTree','FaTriangleExclamation','FaTrophy',
    'FaTruckFast','FaTruckMedical','FaTruckMoving','FaTruckPickup','FaTruck','FaTv','FaUnderline','FaUndo', // Assuming FaArrowRotateLeft equiv
    'FaUniversalAccess','FaUniversity', // Assuming FaBuildingColumns equiv
    'FaUnlockAlt', // Assuming FaUnlockKeyhole equiv
    'FaUnlockKeyhole','FaUnlock','FaUnlink', // Assuming FaLinkSlash equiv
    'FaUpDownLeftRight','FaUpDown','FaUpLong','FaUpRightAndDownLeftFromCenter','FaUpRightFromSquare','FaUpload',
    'FaUserAlt', // Assuming FaCircleUser equiv
    'FaUserAstronaut','FaUserCheck','FaUserClock','FaUserDoctor','FaUserEdit', // Assuming FaUserPen equiv
    'FaUserFriends', // Assuming FaUsers equiv
    'FaUserGear','FaUserGraduate','FaUserGroup','FaUserInjured','FaUserLargeSlash','FaUserLarge','FaUserLock',
    'FaUserMd', // Assuming FaUserDoctor equiv
    'FaUserMinus','FaUserNinja','FaUserNurse','FaUserPen','FaUserPlus','FaUserSecret','FaUserShield','FaUserSlash',
    'FaUserTag','FaUserTie','FaUserTimes', // Assuming FaUserXmark equiv
    'FaUserXmark','FaUser','FaUsersBetweenLines','FaUsersCog', // Assuming FaUsersGear equiv
    'FaUsersGear','FaUsersLine','FaUsersRays','FaUsersRectangle','FaUsersSlash','FaUsersViewfinder','FaUsers',
    'FaUtensils','FaVectorSquare','FaVial','FaVials','FaVideoSlash','FaVideo','FaVolumeDown', // Assuming FaVolumeLow equiv
    'FaVolumeHigh','FaVolumeLow','FaVolumeMute', // Assuming FaVolumeXmark equiv
    'FaVolumeOff','FaVolumeUp', // Assuming FaVolumeHigh equiv
    'FaVolumeXmark','FaWallet','FaWandMagicSparkles','FaWandMagic','FaWandSparkles','FaWarehouse','FaWater',
    'FaWeightHanging','FaWeightScale','FaWifi','FaWind','FaWindowClose', // Assuming FaRectangleXmark equiv
    'FaWindowMaximize','FaWindowMinimize','FaWindowRestore','FaWineGlass','FaWrench','FaXRay','FaXmark','FaYenSign', // JPY Symbol
    'FaRegAddressBook','FaRegAddressCard','FaRegBellSlash','FaRegBell','FaRegBookmark','FaRegBuilding','FaRegCalendarCheck',
    'FaRegCalendarDays','FaRegCalendarMinus','FaRegCalendarPlus','FaRegCalendarXmark','FaRegCalendar','FaRegChartBar',
    'FaRegCheckCircle', // Assuming FaRegCircleCheck equiv
    'FaRegCheckSquare', // Assuming FaRegSquareCheck equiv
    'FaRegCircleCheck','FaRegCircleDot','FaRegCircleDown','FaRegCircleLeft','FaRegCirclePause','FaRegCirclePlay',
    'FaRegCircleQuestion','FaRegCircleRight','FaRegCircleStop','FaRegCircleUp','FaRegCircleUser','FaRegCircleXmark',
    'FaRegCircle','FaRegClipboard','FaRegClock','FaRegClone','FaRegClosedCaptioning','FaRegCommentDots','FaRegComment',
    'FaRegComments','FaRegCompass','FaRegCopy','FaRegCopyright','FaRegCreditCard','FaRegEdit', // Assuming FaRegPenToSquare equiv
    'FaRegEnvelopeOpen','FaRegEnvelope','FaRegEyeSlash','FaRegEye','FaRegFaceAngry','FaRegFaceDizzy','FaRegFaceFlushed',
    'FaRegFaceFrownOpen','FaRegFaceFrown','FaRegFaceGrimace','FaRegFaceGrinBeamSweat','FaRegFaceGrinBeam',
    'FaRegFaceGrinHearts','FaRegFaceGrinSquintTears','FaRegFaceGrinSquint','FaRegFaceGrinStars','FaRegFaceGrinTears',
    'FaRegFaceGrinTongueSquint','FaRegFaceGrinTongueWink','FaRegFaceGrinTongue','FaRegFaceGrinWide','FaRegFaceGrinWink',
    'FaRegFaceGrin','FaRegFaceKissBeam','FaRegFaceKissWinkHeart','FaRegFaceKiss','FaRegFaceLaughBeam','FaRegFaceLaughSquint',
    'FaRegFaceLaughWink','FaRegFaceLaugh','FaRegFaceMehBlank','FaRegFaceMeh','FaRegFaceRollingEyes','FaRegFaceSadCry',
    'FaRegFaceSadTear','FaRegFaceSmileBeam','FaRegFaceSmileWink','FaRegFaceSmile','FaRegFaceSurprise','FaRegFaceTired',
    'FaRegFileAlt', // Assuming FaRegFileLines equiv
    'FaRegFileArchive', // Assuming FaRegFileZipper equiv
    'FaRegFileAudio','FaRegFileCode','FaRegFileExcel','FaRegFileImage','FaRegFileLines','FaRegFilePdf','FaRegFilePowerpoint',
    'FaRegFileVideo','FaRegFileWord','FaRegFileZipper','FaRegFile','FaRegFlag','FaRegFloppyDisk','FaRegFolderClosed',
    'FaRegFolderOpen','FaRegFolder','FaRegFutbol','FaRegGem','FaRegHandLizard','FaRegHandPeace','FaRegHandPointDown',
    'FaRegHandPointLeft','FaRegHandPointRight','FaRegHandPointUp','FaRegHandPointer','FaRegHandScissors','FaRegHandSpock',
    'FaRegHand','FaRegHandshake','FaRegHardDrive','FaRegHeart','FaRegHospital','FaRegHourglass','FaRegIdBadge',
    'FaRegIdCard','FaRegImage','FaRegImages','FaRegKeyboard','FaRegLemon','FaRegLifeRing','FaRegLightbulb','FaRegListAlt', // Assuming FaRegRectangleList equiv
    'FaRegMap','FaRegMeh', // Assuming FaRegFaceMeh equiv
    'FaRegMessage','FaRegMoneyBill1','FaRegMoon','FaRegNewspaper','FaRegNoteSticky','FaRegObjectGroup','FaRegObjectUngroup',
    'FaRegPaperPlane','FaRegPaste','FaRegPauseCircle', // Assuming FaRegCirclePause equiv
    'FaRegPenToSquare','FaRegPlayCircle', // Assuming FaRegCirclePlay equiv
    'FaRegQuestionCircle', // Assuming FaRegCircleQuestion equiv
    'FaRegRectangleList','FaRegRectangleXmark','FaRegRegistered','FaRegSave', // Assuming FaRegFloppyDisk equiv
    'FaRegShareFromSquare','FaRegSmile', // Assuming FaRegFaceSmile equiv
    'FaRegSmileBeam', // Assuming FaRegFaceSmileBeam equiv
    'FaRegSmileWink', // Assuming FaRegFaceSmileWink equiv
    'FaRegSnowflake','FaRegSquareCaretDown','FaRegSquareCaretLeft','FaRegSquareCaretRight','FaRegSquareCaretUp',
    'FaRegSquareCheck','FaRegSquareFull','FaRegSquareMinus','FaRegSquarePlus','FaRegSquare','FaRegStarHalfStroke',
    'FaRegStarHalf','FaRegStar','FaRegStopCircle', // Assuming FaRegCircleStop equiv
    'FaRegSun','FaRegThumbsDown','FaRegThumbsUp','FaRegTimesCircle', // Assuming FaRegCircleXmark equiv
    'FaRegTrashAlt', // Assuming FaRegTrashCan equiv
    'FaRegTrashCan','FaRegUserCircle', // Assuming FaRegCircleUser equiv
    'FaRegUser','FaRegWindowMaximize','FaRegWindowMinimize','FaRegWindowRestore',
]);



// .. Other constants remain the same
const importChecks = [
    { name: 'motion', usageRegex: /<motion\./, importRegex: /import .* from ['"]framer-motion['"]/, importStatement: `import { motion } from "framer-motion";` },
    { name: 'clsx', usageRegex: /clsx\(/, importRegex: /import clsx from ['"]clsx['"]/, importStatement: `import clsx from "clsx";` },
    // Added React import check
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
    const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
    const [rawDescription, setRawDescription] = useState<string>("");
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    // .. Parsing Logic remains the same ...
    const parseFilesFromText = useCallback((text: string): { files: FileEntry[], description: string, parseErrors: ValidationIssue[] } => {
        const files: FileEntry[] = [];
        const parseErrors: ValidationIssue[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([\w\-\/\.\[\]]+?\.\w+)\s*(?:\*\/)?\s*$)\n*)?^\s*```(\w+)?\n([\s\S]*?)\n^\s*```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*(?:File:\s*)?([\w\-\/\.\[\]]+?\.\w+)\s*(?:\*\/)?\s*$))?/gm;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            const currentMatchIndex = match.index;
            if (currentMatchIndex > lastIndex) {
                descriptionParts.push(text.substring(lastIndex, currentMatchIndex).trim());
            }
            lastIndex = codeBlockRegex.lastIndex;

            let path = (match[1] || match[4] || `unnamed-${files.length + 1}`).trim();
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
                    }
                }
            }
            if (path !== '/') path = path.replace(/^[\/\\]+/, '');

            if (content.includes('```')) {
                 const fileId = generateId();
                 parseErrors.push({ id: generateId(), fileId: fileId, filePath: path || `parse-error-${fileId}`, type: 'parseError', message: `Обнаружен вложенный блок кода (\`\`\`). Разбор может быть некорректным.`, details: { lineNumber: -1 }, fixable: false, restorable: false, severity: 'error' });
            }
            files.push({ id: generateId(), path, content, extension });
        }
        if (lastIndex < text.length) { descriptionParts.push(text.substring(lastIndex).trim()); }
        const description = descriptionParts.filter(Boolean).join('\n\n');
        return { files, description, parseErrors };
    }, []);


    // --- Validation Logic ---
    const validateParsedFiles = useCallback(async (filesToValidate: FileEntry[]): Promise<ValidationIssue[]> => {
        setValidationStatus('validating');
        const issues: ValidationIssue[] = [];

        for (const file of filesToValidate) {
            if (file.path.startsWith('unnamed-') || file.path.startsWith('parse-error-')) continue;
            const lines = file.content.split('\n');
            const fileId = file.id;
            const filePath = file.path;

            // .. 1. Legacy Icon Check (react-icons/fa) - Kept for backward compatibility?
            const legacyIconImportRegex = /import\s+{([^}]*)}\s+from\s+['"]react-icons\/fa['"]/g;
            let legacyImportMatch;
            while ((legacyImportMatch = legacyIconImportRegex.exec(file.content)) !== null) {
                const legacyImportLineNumber = file.content.substring(0, legacyImportMatch.index).split('\n').length;
                const legacyImportedIcons = legacyImportMatch[1].split(',').map(i => i.trim().split(/\s+as\s+/)[0]).filter(Boolean);
                legacyImportedIcons.forEach(iconName => {
                    const replacement = legacyIconReplacements[iconName];
                    const usageRegex = new RegExp(`<${iconName}(?![-_a-zA-Z0-9])(\\s|\\/?>)`);
                    if (usageRegex.test(file.content)) { // Simple usage check
                         issues.push({ id: generateId(), fileId, filePath, type: 'iconLegacy', message: `Legacy icon ${iconName} from 'react-icons/fa'. ${replacement ? `Replace with ${replacement} from /fa6?` : 'Replace?'}`, details: { badIcon: iconName, goodIcon: replacement, lineNumber: legacyImportLineNumber }, fixable: !!replacement, severity: 'warning' });
                     }
                });
            }

             // .. 2. NEW: Fa6 Icon Checks (Correctness & Existence)
             const fa6ImportRegex = /import\s+{([^}]+)}\s+from\s+['"]react-icons\/fa6['"];?/g;
             let fa6Match;
             while ((fa6Match = fa6ImportRegex.exec(file.content)) !== null) {
                 const importList = fa6Match[1];
                 const importLineNumber = file.content.substring(0, fa6Match.index).split('\n').length;
                 const importedFa6IconsRaw = importList.split(',').map(i => i.trim()).filter(Boolean);

                 importedFa6IconsRaw.forEach(rawImport => {
                     // Handle potential aliases like "FaTools as MyTool" -> only check "FaTools"
                     const iconName = rawImport.split(/\s+as\s+/)[0].trim();
                     if (!iconName) return; // Skip empty/invalid entries

                     // Check if it's a known incorrect name needing correction
                     if (knownIncorrectFa6Names.includes(iconName)) {
                         const correctName = fa6IconCorrectionMap[iconName];
                         issues.push({
                             id: generateId(), fileId, filePath, type: 'incorrectFa6IconName',
                             message: `Некорректное имя иконки: '${iconName}'. Исправить на '${correctName}'?`,
                             details: { lineNumber: importLineNumber, incorrectName: iconName, correctName: correctName, importStatement: fa6Match[0] },
                             fixable: true, // Can be auto-fixed
                             severity: 'warning'
                         });
                     }
                     // Check if it's NOT in the valid list AND not slated for correction
                     else if (!validFa6Icons.has(iconName)) {
                         issues.push({
                             id: generateId(), fileId, filePath, type: 'unknownFa6IconName',
                             message: `Неизвестная/несуществующая иконка Fa6: '${iconName}'. Проверьте имя или замените.`,
                             details: { lineNumber: importLineNumber, unknownName: iconName, importStatement: fa6Match[0] },
                             fixable: false, // Cannot be auto-fixed
                             severity: 'error'
                         });
                     }
                     // Else: It's a known correct icon, do nothing
                 });
             }


            // .. 3. "use client" Check
            if (/\.(tsx|jsx)$/.test(filePath)) {
                 const firstRealLineIndex = lines.findIndex(line => line.trim() !== '');
                 const firstRealLine = firstRealLineIndex !== -1 ? lines[firstRealLineIndex].trim() : null;
                 const hasUseClient = firstRealLine === '"use client";' || firstRealLine === "'use client';";
                 const usesClientFeatures = clientHookPatterns.test(file.content) || /on[A-Z][a-zA-Z]*\s*=\s*{/.test(file.content);

                 if (!hasUseClient && usesClientFeatures) {
                      let firstUsageLine = -1;
                      const hookMatch = clientHookPatterns.exec(file.content);
                      const eventMatch = /on[A-Z][a-zA-Z]*\s*=\s*{/.exec(file.content);
                      if (hookMatch || eventMatch) {
                          const searchIndex = Math.min(hookMatch?.index ?? Infinity, eventMatch?.index ?? Infinity);
                          if (searchIndex !== Infinity) {
                              firstUsageLine = (file.content.substring(0, searchIndex).match(/\n/g) || []).length + 1;
                          }
                      }
                      const featureName = hookMatch?.[1] ?? (eventMatch ? 'event handler' : 'client feature');
                     issues.push({ id: generateId(), fileId, filePath, type: 'useClient', message: `Found ${featureName} without "use client".`, details: { lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined }, fixable: true, severity: 'warning' });
                 }
             }

            // .. 4. Skipped Code Block Check
            for (let i = 0; i < lines.length; i++) {
                if (skippedCodeBlockMarkerRegex.test(lines[i].trimStart())) {
                    issues.push({ id: generateId(), fileId, filePath, type: 'skippedCodeBlock', message: `Skipped code block (line ${i + 1}). Can attempt restore.`, details: { markerLineContent: lines[i], lineNumber: i + 1 }, fixable: false, restorable: true, severity: 'warning' });
                }
            }

            // .. 5. Skipped Comment Check
            for (let i = 0; i < lines.length; i++) {
                const trimmedLine = lines[i].trimStart();
                if (skippedCommentRealRegex.test(trimmedLine) && !skippedCommentKeepRegex.test(trimmedLine)) {
                     issues.push({ id: generateId(), fileId, filePath, type: 'skippedComment', message: `Skipped comment '// ..''.' (line ${i + 1}). Needs manual review.`, details: { lineNumber: i + 1 }, fixable: false, restorable: false, severity: 'warning' });
                 }
            }

            // .. 6. Import Checks
            if (/\.(tsx|jsx)$/.test(filePath)) {
                importChecks.forEach(check => {
                    if (check.usageRegex.test(file.content) && !check.importRegex.test(file.content)) {
                         let firstUsageLine = -1;
                         const usageMatch = check.usageRegex.exec(file.content);
                         if (usageMatch) { firstUsageLine = (file.content.substring(0, usageMatch.index).match(/\n/g) || []).length + 1; }
                         issues.push({ id: generateId(), fileId, filePath, type: 'import', message: `Using '${check.name}' but import is missing.`, details: { name: check.name, importStatement: check.importStatement, lineNumber: firstUsageLine > 0 ? firstUsageLine : undefined }, fixable: true, severity: 'warning' });
                    }
                });
            }
        } // End loop through files

        setValidationIssues(issues);
        if (issues.length > 0) {
            const hasErrors = issues.some(issue => issue.severity === 'error' || (!issue.fixable && !issue.restorable)); // Treat unknown icons as errors for status
            const hasWarnings = issues.some(issue => issue.severity === 'warning');
            setValidationStatus(hasErrors ? 'error' : (hasWarnings ? 'warning' : 'error')); // Fallback error
        } else {
            setValidationStatus('success');
        }
        return issues;
    }, []); // Dependencies stable


    // .. Main Parsing and Validation Trigger remains the same ...
     const parseAndValidateResponse = useCallback(async (response: string) => {
        setIsParsing(true); setValidationStatus('idle'); setValidationIssues([]); setParsedFiles([]); setRawDescription("");
        if (!response.trim()) { toast.info("Поле ответа пусто."); setIsParsing(false); return { files: [], description: "", issues: [] }; }

        try {
            const { files, description, parseErrors } = parseFilesFromText(response);
            setParsedFiles(files); setRawDescription(description);
            let validationIssuesResult: ValidationIssue[] = [];
            if (files.length > 0) {
                toast.info(`${files.length} файлов найдено. Запуск проверки...`, { duration: 1500 });
                validationIssuesResult = await validateParsedFiles(files);
            } else {
                toast.info("В ответе не найдено файлов кода для разбора.");
                setValidationStatus('idle');
            }

            const allIssues = [...parseErrors, ...validationIssuesResult];
            setValidationIssues(allIssues);

            if (allIssues.length > 0) {
                const hasErrors = allIssues.some(issue => issue.severity === 'error' || (!issue.fixable && !issue.restorable));
                const hasWarnings = allIssues.some(issue => issue.severity === 'warning');
                setValidationStatus(hasErrors ? 'error' : (hasWarnings ? 'warning' : 'error'));
            } else if (files.length > 0) {
                setValidationStatus('success');
            } else {
                setValidationStatus('idle');
            }
            setIsParsing(false);
            return { files, description, issues: allIssues };
         } catch (error) {
             console.error("Critical error during parsing/validation:", error);
             toast.error("Критическая ошибка при разборе ответа.");
             setIsParsing(false); setValidationStatus('error');
             const genericError: ValidationIssue = { id: generateId(), fileId: 'general', filePath: 'N/A', type: 'parseError', message: `Критическая ошибка разбора: ${error instanceof Error ? error.message : String(error)}`, details: null, fixable: false, restorable: false, severity: 'error' };
             setValidationIssues([genericError]);
             return { files: [], description: rawDescription, issues: [genericError] };
         }
    }, [parseFilesFromText, validateParsedFiles, rawDescription]);


    // --- Auto-Fixing Logic ---
    const autoFixIssues = useCallback((filesToFix: FileEntry[], issuesToFix: ValidationIssue[]): FileEntry[] => {
        let changesMadeCount = 0; const fixedMessages: string[] = [];
        const fixableIssues = issuesToFix.filter(issue => issue.fixable);

        if (fixableIssues.length === 0) {
             toast.info("Не найдено проблем для автоматического исправления.");
             return filesToFix;
        }

        const updatedFiles = filesToFix.map(file => {
            let currentContent = file.content; let fileChanged = false;
            const fileIssues = fixableIssues.filter(issue => issue.fileId === file.id);
            if (fileIssues.length === 0) return file;

            fileIssues.forEach(issue => {
                try {
                    // .. 1. NEW: Fix incorrect Fa6 icon names
                    if (issue.type === 'incorrectFa6IconName' && issue.details?.incorrectName && issue.details?.correctName && issue.details?.importStatement) {
                         const incorrectName = issue.details.incorrectName;
                         const correctName = issue.details.correctName;
                         const importLine = issue.details.importStatement;
                         const lines = currentContent.split('\n');
                         const importLineIndex = lines.findIndex(line => line.includes(importLine)); // Find the exact import line

                         if (importLineIndex !== -1) {
                             // Replace within the specific line only
                             const nameRegex = new RegExp(`\\b${incorrectName}\\b`, 'g'); // Use word boundary
                             const originalLine = lines[importLineIndex];
                             const modifiedLine = originalLine.replace(nameRegex, correctName);

                             if (modifiedLine !== originalLine) { // Check if replacement actually happened
                                 lines[importLineIndex] = modifiedLine;
                                 currentContent = lines.join('\n');
                                 fileChanged = true;
                                 fixedMessages.push(`✅ Fa6 Иконка: ${incorrectName} -> ${correctName} в ${file.path}`);
                             } else {
                                 console.warn(`AutoFix: Incorrect icon name ${incorrectName} regex did not match in specific import line: "${originalLine}" in ${file.path}`);
                             }
                         } else {
                             console.warn(`AutoFix: Could not find import line "${importLine}" for Fa6 icon fix in ${file.path}`);
                         }

                    // .. 2. Fix legacy icons (keep existing logic, update type check)
                    } else if (issue.type === 'iconLegacy' && issue.details?.badIcon && issue.details?.goodIcon) {
                        const bad = issue.details.badIcon; const good = issue.details.goodIcon; const usageOpenRegex = new RegExp(`<${bad}(?![-_a-zA-Z0-9])(\\s|\\/?>)`, 'g'); const usageCloseRegex = new RegExp(`</${bad}>`, 'g'); const lines = currentContent.split('\n'); let changedInLegacyFix = false;
                        const newLines = lines.map(line => { if (!line.trim().startsWith('//') && !line.trim().startsWith('/*') && (usageOpenRegex.test(line) || usageCloseRegex.test(line))) { changedInLegacyFix = true; let newLine = line.replace(usageOpenRegex, `<${good}$1`); newLine = newLine.replace(usageCloseRegex, `</${good}>`); return newLine; } return line; });
                        if (changedInLegacyFix) { currentContent = newLines.join('\n'); fileChanged = true; fixedMessages.push(`✅ Legacy Icon: ${bad} -> ${good} в ${file.path}`);
                            const importRegexFa = new RegExp(`(import\\s+{[^}]*}\\s+from\\s+['"]react-icons/fa['"])`);
                            if (importRegexFa.test(currentContent)) { currentContent = currentContent.replace(importRegexFa, `$1;\n// TODO: Consider changing import to 'react-icons/fa6' for ${good}`); }
                         }

                    // .. 3. Fix "use client" (keep existing logic)
                    } else if (issue.type === 'useClient') {
                        const lines = currentContent.split('\n'); let firstCodeLineIndex = -1;
                        for (let i = 0; i < lines.length; i++) { const trimmedLine = lines[i].trim(); if (trimmedLine !== '' && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) { firstCodeLineIndex = i; break; } }
                        const alreadyHasUseClient = firstCodeLineIndex !== -1 && (lines[firstCodeLineIndex] === '"use client";' || lines[firstCodeLineIndex] === "'use client';");
                        if (!alreadyHasUseClient) { const insertIndex = firstCodeLineIndex !== -1 ? firstCodeLineIndex : 0; const newLineChar = insertIndex === 0 || (firstCodeLineIndex !== -1 && lines[insertIndex].trim() !== '') ? '\n' : ''; lines.splice(insertIndex, 0, '"use client";' + newLineChar); currentContent = lines.join('\n'); fixedMessages.push(`✅ Added "use client"; to ${file.path}`); fileChanged = true; }

                    // .. 4. Fix missing imports (keep existing logic)
                    } else if (issue.type === 'import' && issue.details?.importStatement && issue.details?.importRegex) {
                        const importRegex: RegExp = issue.details.importRegex;
                        if (!importRegex.test(currentContent)) {
                            const lines = currentContent.split('\n'); let insertIndex = 0; let useClientIndex = -1;
                             for (let i = 0; i < lines.length; i++) { const tl = lines[i].trim(); if (tl === '"use client";' || tl === "'use client';") { useClientIndex = i; insertIndex = i + 1; } else if (tl.startsWith('import ')) { insertIndex = i + 1; } else if (tl !== '' && !tl.startsWith('//') && !tl.startsWith('/*')) { if (insertIndex === 0 && useClientIndex === -1) insertIndex = 0; break; } }
                             const prefixNewLine = (useClientIndex !== -1 || insertIndex > 0) && lines[insertIndex]?.trim() !== '' ? '\n' : '';
                             lines.splice(insertIndex, 0, prefixNewLine + issue.details.importStatement); currentContent = lines.join('\n'); fixedMessages.push(`✅ Added import for '${issue.details.name}' to ${file.path}`); fileChanged = true;
                        }
                    }
                 } catch (fixError) {
                      console.error(`Error auto-fixing issue ${issue.id} (${issue.type}) in file ${file.path}:`, fixError);
                      toast.error(`Ошибка исправления ${issue.type} в ${file.path}`);
                 }
            });

            if (fileChanged) changesMadeCount++;
            return { ...file, content: currentContent };
        });

        if (changesMadeCount > 0) {
            // --- CRITICAL FIX: Update the state with the modified files ---
            setParsedFiles(updatedFiles); // <<< THIS LINE WAS MISSING!
            // --- END CRITICAL FIX ---

            fixedMessages.forEach(msg => toast.success(msg, { duration: 4000 }));
            console.log("Re-validating files after auto-fix...");
            validateParsedFiles(updatedFiles); // Re-validate AFTER fixing
        } else {
            // If no changes were made but there were fixable issues, something might be wrong
            if (fixableIssues.length > 0) {
                 toast.warning("Авто-исправление было запущено, но не внесло изменений. Возможно, проблемы уже исправлены или логика фиксации нуждается в проверке.");
            }
            // Check if only non-fixable, non-restorable issues remain
            const nonFixableOrRestorable = validationIssues.some(i => !i.fixable && !i.restorable);
            if (validationStatus === 'warning' && !nonFixableOrRestorable) {
                setValidationStatus('success');
            }
        }
        return updatedFiles; // Return the potentially modified files
    }, [validationIssues, validationStatus, validateParsedFiles]);


    return {
        parsedFiles, rawDescription, validationStatus, validationIssues, isParsing,
        parseAndValidateResponse, autoFixIssues,
        setParsedFiles, setValidationStatus, setValidationIssues, setIsParsing, setRawDescription,
    };
}
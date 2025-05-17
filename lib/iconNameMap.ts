import type * as Fa6Icons from "react-icons/fa6";

export const iconNameMap: { [key: string]: keyof typeof Fa6Icons } = {
  // General & UI
  fathumbsup: "FaThumbsUp",
  faeye: "FaEye",
  fakeyboard: "FaKeyboard",
  fawandmagicsparkles: "FaWandMagicSparkles",
  facheckdouble: "FaCheckDouble",
  fatools: "FaToolbox", 
  facodebranch: "FaCodeBranch",
  falandmineon: "FaLandMineOn",
  fascrewdriverwrench: "FaScrewdriverWrench",
  fasmilewink: "FaFaceSmileWink", // Corrected to FaFaceSmileWink
  fatriangleexclamation: "FaTriangleExclamation",
  facrosshairs: "FaCrosshairs",
  fabookmedical: "FaBookMedical",
  fashieldhalved: "FaShieldHalved",
  faaward: "FaAward",
  fabookopen: "FaBookOpen",
  fabrain: "FaBrain",
  fainfinity: "FaInfinity",
  farecycle: "FaRecycle",
  fashapes: "FaShapes",
  fahammer: "FaHammer",
  faprojectdiagram: "FaDiagramProject", // Corrected to FaDiagramProject
  fabroadcasttower: "FaTowerBroadcast", // Corrected to FaTowerBroadcast
  fauniversalaccess: "FaUniversalAccess",
  fabong: "FaBong",
  fafire: "FaFire",
  fasatellitedish: "FaSatelliteDish",
  falaptopcode: "FaLaptopCode",
  fatoolbox: "FaToolbox",
  falink: "FaLink",
  faupload: "FaUpload",
  facheck: "FaCheck",
  faexchangealt: "FaRightLeft", // FaExchangeAlt does not exist, using FaRightLeft
  faimageslash: "FaImage", // FaImageSlash does not exist, FaImage can be used, or handle slash visually
  faimageportrait: "FaImagePortrait",
  faplaycircle: "FaCirclePlay", // Corrected to FaCirclePlay (or FaRegCirclePlay)
  faexternallinkalt: "FaArrowUpRightFromSquare", // FaExternalLinkAlt does not exist, using FaArrowUpRightFromSquare
  fabomb: "FaBomb",
  famedal: "FaMedal",
  favideo: "FaVideo",
  favideoslash: "FaVideoSlash",
  fafilm: "FaFilm",
  faroad: "FaRoad",
  fauserninja: "FaUserNinja",
  fagamepad: "FaGamepad",
  facircleuser: "FaCircleUser",
  facreditcard: "FaCreditCard", // Or FaRegCreditCard
  fastar: "FaStar", // Or FaRegStar
  fagears: "FaGears",
  fausers: "FaUsers",
  farocket: "FaRocket",
  fanetworkwired: "FaNetworkWired",
  fareglightbulb: "FaRegLightbulb",
  fapalette: "FaPalette",
  facircleinfo: "FaCircleInfo",
  fadollarsign: "FaDollarSign",
  facaron: "FaCarOn", 
  farobot: "FaRobot",
  famagnifyingglass: "FaMagnifyingGlass",
  fagift: "FaGift",
  fafileinvoicedollar: "FaFileInvoiceDollar",
  faheart: "FaHeart", // Or FaRegHeart
  falistcheck: "FaListCheck",
  faglobe: "FaGlobe",
  falandmarkdome: "FaLandmarkDome",
  faleaf: "FaLeaf",
  fausershield: "FaUserShield",
  fayoutube: "FaYoutube",
  fabookuser: "FaUserGraduate", // FaBookUser does not exist, FaUserGraduate might be similar
  fabolt: "FaBolt",
  fakey: "FaKey",
  fadooropen: "FaDoorOpen",
  faregcopy: "FaRegCopy",
  fapaste: "FaPaste", // Or FaRegPaste
  famagic: "FaWandMagicSparkles", 
  facheckcircle: "FaCircleCheck", // Corrected to FaCircleCheck (or FaRegCircleCheck)
  facrown: "FaCrown",
  facopy: "FaCopy",
  faclouduploadalt: "FaCloudArrowUp", // FaCloudUploadAlt does not exist, using FaCloudArrowUp
  faforwardstep: "FaForwardStep",
  faserver: "FaServer",
  faphotofilm: "FaPhotoFilm", 
  favideocamera: "FaVideo", // FaVideoCamera does not exist, simplified to FaVideo
  fapoostorm: "FaPooStorm",
  fabook: "FaBook",
  fabiohazard: "FaBiohazard",
  fameteor: "FaMeteor",
  fadumbbell: "FaDumbbell",
  fafistraised: "FaHandFist", // FaFistRaised does not exist, using FaHandFist
  fastreetview: "FaStreetView",
  fahandmiddlefinger: "FaHandMiddleFinger",
  facity: "FaCity", 
  faangledoubledown: "FaAnglesDown", // Corrected to FaAnglesDown
  faguitar: "FaGuitar",

  // StickyChat specific icons
  faarrowright: "FaArrowRight",
  fahighlighter: "FaHighlighter",
  fagithub: "FaGithub",
  fadownload: "FaDownload",
  facode: "FaCode",
  facommentdots: "FaCommentDots", // Or FaRegCommentDots
  fapaperplane: "FaPaperPlane", // Or FaRegPaperPlane
  falightbulb: "FaLightbulb", 
  faimages: "FaImages", // Or FaRegImages
  fasquarearrowupright: "FaSquareArrowUpRight",
  fafileimport: "FaFileImport",
  faclipboardlist: "FaClipboardList",
  faicons: "FaIcons", 
  faspinner: "FaSpinner",
  fauplong: "FaUpLong", // Added previously in page.tsx, ensure consistency
  
  // Error and diagnostics related
  favial: "FaVial",
  fadatabase: "FaDatabase",
  faboxarchive: "FaBoxArchive",
  facoins: "FaCoins",
  fakraken: "FaBattleNet", // FaKraken not available, using FaBattleNet as a placeholder for a fantasy/brand icon
  facodecommit: "FaCodeCommit",
  fatree: "FaTree",
  faplus: "FaPlus",
  fabroom: "FaBroom",
  fascroll: "FaScroll",
  famobilescreenbutton: "FaMobileScreenButton",
  fauserdoctor: "FaUserDoctor",
  fapuzzlepiece: "FaPuzzlePiece",
  falayergroup: "FaLayerGroup",
  fagraduationcap: "FaGraduationCap",
  faheartbeat: "FaHeartPulse", // FaHeartbeat does not exist, using FaHeartPulse

  // New additions
  faangleup: "FaAngleUp",
  faangledown: "FaAngleDown",
  faangleleft: "FaAngleLeft",
  faangleright: "FaAngleRight",
  faxmarkcircle: "FaCircleXmark", // Or FaRegCircleXmark
  fafile: "FaFile", // Or FaRegFile
  fafolder: "FaFolder", // Or FaRegFolder
  fafolderopen: "FaFolderOpen", // Or FaRegFolderOpen
  faterminal: "FaTerminal",
  facloud: "FaCloud",
  faellipsisvertical: "FaEllipsisVertical",
  faellipsis: "FaEllipsis",
  fapluscircle: "FaCirclePlus",
  faminuscircle: "FaCircleMinus",
  fatrash: "FaTrashCan", // Or FaRegTrashCan
  faregstar: "FaRegStar",
  faregfile: "FaRegFile",
  faregfolder: "FaRegFolder",
  faregfolderopen: "FaRegFolderOpen",
  fagear: "FaGear", // Alias for fagears
  fapentofquare: "FaPenToSquare", // Or FaRegPenToSquare
  fasignoutalt: "FaRightFromBracket" // FaSignOutAlt does not exist
};
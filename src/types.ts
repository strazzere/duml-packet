export interface PacketOptions {
  raw?: Buffer;

  version?: number;
  length?: number;
  crcHead?: number;

  sourceRaw?: number;
  sourceType?: DeviceType;
  sourceIndex?: number;

  destinationRaw?: number;
  destinationType?: number;
  destinationIndex?: number;

  sequenceID?: number;

  commandTypeRaw?: number;
  commandType?: CommandType;
  ackType?: AckType;
  encryptionType?: EncryptionType;

  commandSet?: number;
  command?: number;
  commandPayload?: Buffer;

  crc?: number;
}

export enum DeviceType {
  ANY = 0,
  CAMERA = 1,
  MOBILE_APP = 2,
  FLIGHT_CONTROLLER = 3,
  GIMBAL = 4,
  MAIN_BOARD = 5,
  REMOTE_RADIO = 6,
  WIFI_SKY = 7,
  LB_DM3XX_SKY = 8, // ve_air
  LB_MCU_SKY = 9,
  PC = 10,
  BATTERY = 11,
  ESC = 12,
  DM368_GROUND = 13,
  OFDM_GROUND = 14,
  LB_68013_SKY = 15,
  SER_68013_GROUND = 16,
  MVO = 17,
  SVO = 18,
  LB_FPGA_SKY = 19,
  FPGA_GROUND = 20,
  FPGA_SIMULATION = 21,
  BASE_STATION = 22,
  XU = 23,
  REMOTE_BATTERY = 24,
  IMU = 25,
  GPS = 26,
  WIFI_GROUND = 27,
  SIG_CVT = 28,
  PMU = 29,
  UKNOWN_30 = 30,
  WM330_OR_WM220 = 31,
}

export enum CommandType {
  REQUEST = 0,
  ACK = 1,
}

export enum AckType {
  NO_ACK = 0,
  PUSH = 1, // "ACK Before Exec"
  ACK = 2,
  RESPONSE = 3,
}

export enum EncryptionType {
  NONE = 0,
  AES_128 = 1,
  SELF_DEF = 2,
  XOR = 3,
  DES_56 = 4,
  DES_112 = 5,
  AES_192 = 6,
  AES_256 = 7,
}

export enum SetType {
  GENERAL = 0,
  SPECIAL = 1,
  CAMERA = 2,
  FLIGHT_CONTROLLER = 3,
  GIMBAL = 4,
  CENTER_BOARD = 5,
  RADIO = 6,
  WIFI = 7,
  DM368 = 8,
  HD_MAP = 9,
  VPS_AVOID = 10,
  SIM = 11,
  ORDER = 12,
  BATTERY = 13,
  DATA_RECORDER = 14,
  RTK = 15,
  AUTOTEST = 16,
  ADSB = 17,
  UNKNOWN_18 = 18,
  UNKNOWN_19 = 19,
  UNKNOWN_20 = 20,
  UNKNOWN_21 = 21,
  UNKNOWN_22 = 22,
  UNKNOWN_23 = 23,
  UNKNOWN_24 = 24,
  UNKNOWN_25 = 25,
  UNKNOWN_26 = 26,
  UNKNOWN_27 = 27,
  UNKNOWN_28 = 28,
  UNKNOWN_29 = 29,
  UNKNOWN_30 = 30,
  UNKNOWN_31 = 31,
}

// Many of these inferred from binaries and others taken from
// https://github.com/o-gs/dji-firmware-tools/blob/05e24cb12803943f63ac5ae1574e517e59a2dd0a/comm_dissector/wireshark/dji-dumlv1-general.lua#L9
export enum GeneralTypes {
  PING = 0,
  VERSION_REQUEST = 1,
  PUSH_PARAM_SET = 2,
  PUSH_PARAM_GET = 3,
  PUSH_PARAM_START = 4,
  MULTI_PARAM_SET = 5,
  MULTI_PARAM_GET = 6,
  ENTER_LOADER = 7,
  UPDATE_CONFIRM = 8,
  UPDATE_TRANSMIT = 9,
  UPDATE_FINISH = 10,
  REBOOT_CHIP = 11,
  GET_DEVICE_STATE = 12,
  GET_DEVICE_VERSION = 13,
  HEARTBEAT = 14,
  UPDATE_SELF_REQUEST = 15,

  SET_SDK_MSG_FREQUENCY = 0x10,

  FILE_LIST = 0x20,
  FILE_INFO = 0x21,
  FILE_SEND = 0x22,
  FILE_RECEIVE = 0x23,
  FILE_SENDING = 0x24,
  FILE_SEGMENT_ERROR = 0x25,
  FILE_TRANS_APP_TO_CAMERA = 0x26,
  FILE_TRANS_CAMERA_TO_APP = 0x27,
  FILE_TRANS_DELETE = 0x28,

  ENCRYPT_CONFIG = 0x30,

  ACTIVATE_CONFIG = 0x32,
  MFI_CERT = 0x33,
  SAFE_COMMUNICATION = 0x34,

  FW_UPDATE_DESC_PUSH = 0x40,
  FW_UPDATE_PUSH_CONTROL = 0x41,
  FW_UPGRADE_PUSH_STATUS = 0x42,

  SLEEP_CONTROL = 0x45,
  SHUTDOWN_NOTIFICATION = 0x46,
  POWER_STATE = 0x47,
  LED_CONTROL = 0x48,

  SET_DATE_TIME = 0x4a,
  GET_DATE_TIME = 0x4b,
  GET_MODULE_SYS_STATUS = 0x4c,
  SET_RT = 0x4d,
  GET_RT = 0x4e,
  GET_CFG_FILE = 0x4f,
  SET_SERIAL_NUMBER = 0x50,
  GET_SERIAL_NUMBER = 0x51,
  SET_GPS_PUSH_CONFIG = 0x52,
  PUSH_GPS_INFO = 0x53,
  GET_TEMPERATURE_INFO = 0x54,
  GET_ALIVE_TIME = 0x55,
  OVER_TEMPERATURE = 0x56,
  SEND_NETWORK_INFO = 0x57,
  TIME_SYNC = 0x58,
  TEST_MODE = 0x59,
  PLAY_SOUND = 0x5a,

  START_FTP = 0x5b,
  UAV_FLU_INFO = 0x5c,

  AUTO_TEST_INFO = 0x60,
  SET_PRODUCT_NEWEST_VERSION = 0x61,
  GET_PRODUCT_NEWEST_VERSION = 0x62,

  SEND_RESERVED_KEY = 0xef,

  LOG_PUSH = 0xf0,
  COMPONENT_SELF_TEST_STATE = 0xf1,
  LOG_CONTROL_GLOBAL = 0xf2,
  LOG_CONTROL_MODULE = 0xf3,
  TEST_START = 0xf4,
  TEST_STOP = 0xf5,
  TEST_QUERY_RESULT = 0xf6,
  PUSH_TEST_RESULT = 0xf7,
  GET_METADATA = 0xf8,

  LOG_CONTROL = 0xfa,
  SELF_TEST_STATE = 0xfb,
  SELF_TEST_STATE_COUNT = 0xfc,
  DUMP_FRAME_BUFFER = 0xfd,
  SELF_DEFINE = 0xfe,
  QUERY_DEVICE_INFO = 0xff,
}

export enum SpecialTypes {
  SDK_CONTROL_NAV_MODE_TOGGLE = 0,
  SPECIAL_APP_CONTROL_OLD = 1,
  SPECIAL_REMOTE_CONTROL_OLD = 2,
  SPECIAL_APP_CONTROL = 3,
  SPECIAL_REMOTE_CONTROL = 4,
  SDK_CONTROL_MODE_TOGGLE = 5,

  SDK_CONTROL_GIMBAL_SPEED = 0x2a,
  SDK_CONTROL_GIMBAL_ANGLE = 0x2b,

  SDK_CONTROL_CAMERA_SHOT = 0x20,
  SDK_CONTROL_CAMERA_START_VIDEO = 0x21,
  SDK_CONTROL_CAMERA_STOP_VIDEO = 0x22,

  UAV_LOOPBACK = 0xff,
}

// TODO : Add support for these

export enum CameraTypes {}
// https://github.com/o-gs/dji-firmware-tools/blob/05e24cb12803943f63ac5ae1574e517e59a2dd0a/comm_dissector/wireshark/dji-dumlv1-camera.lua#L9

// https://github.com/o-gs/dji-firmware-tools/blob/1a4c177ece5ea1023017db272e0dcace3838c639/comm_dissector/wireshark/dji-dumlv1-flyc.lua#L9
export enum FlightControllerTypes {}

export enum GimbalTypes {}

export enum CenterBoardTypes {}

export enum RadioTypes {}

export { DumlPacket, Packet } from "./packet";

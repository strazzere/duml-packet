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
  ANY,
  CAMERA,
  MOBILE_APP,
  FLIGHT_CONTROLLER,
  GIMBAL,
  MAIN_BOARD,
  REMOTE_RADIO,
  WIFI_SKY,
  LB_DM3XX_SKY, // ve_air
  LB_MCU_SKY,
  PC,
  BATTERY,
  ESC,
  DM368_GROUND,
  OFDM_GROUND,
  LB_68013_SKY,
  SER_68013_GROUND,
  MVO,
  SVO,
  LB_FPGA_SKY,
  FPGA_GROUND,
  FPGA_SIMULATION,
  BASE_STATION,
  XU,
  REMOTE_BATTERY,
  IMU,
  GPS,
  WIFI_GROUND,
  SIG_CVT,
  PMU,
  UKNOWN_30,
  WM330_OR_WM220,
}

export enum CommandType {
  REQUEST,
  ACK,
}

export enum AckType {
  NO_ACK,
  PUSH, // "ACK Before Exec"
  ACK,
  RESPONSE,
}

export enum EncryptionType {
  NONE,
  AES_128,
  SELF_DEF,
  XOR,
  DES_56,
  DES_112,
  AES_192,
  AES_256,
}

export enum SetType {
  GENERAL,
  SPECIAL,
  CAMERA,
  FLIGHT_CONTROLLER,
  GIMBAL,
  CENTER_BOARD,
  RADIO,
  WIFI,
  DM368,
  HD_MAP,
  VPS_AVOID,
  SIM,
  ORDER,
  BATTERY,
  DATA_RECORDER,
  RTK,
  AUTOTEST,
  ADSB,
  UNKNOWN_18,
  UNKNOWN_19,
  UNKNOWN_20,
  UNKNOWN_21,
  UNKNOWN_22,
  UNKNOWN_23,
  UNKNOWN_24,
  UNKNOWN_25,
  UNKNOWN_26,
  UNKNOWN_27,
  UNKNOWN_28,
  UNKNOWN_29,
  UNKNOWN_30,
  UNKNOWN_31,
}

// Many of these inferred from binaries and others taken from
// https://github.com/o-gs/dji-firmware-tools/blob/05e24cb12803943f63ac5ae1574e517e59a2dd0a/comm_dissector/wireshark/dji-dumlv1-general.lua#L9
export enum GeneralTypes {
  PING,
  VERSION_REQUEST,
  PUSH_PARAM_SET,
  PUSH_PARAM_GET,
  PUSH_PARAM_START,
  MULTI_PARAM_SET,
  MULTI_PARAM_GET,
  ENTER_LOADER,
  UPDATE_CONFIRM,
  UPDATE_TRANSMIT,
  UPDATE_FINISH,
  REBOOT_CHIP,
  GET_DEVICE_STATE,
  GET_DEVICE_VERSION,
  HEARTBEAT,
  UPDATE_SELF_REQUEST,

  SET_SDK_MSG_FREQUENCY = 0x10,

  FILE_LIST = 0x20,
  FILE_INFO,
  FILE_SEND,
  FILE_RECEIVE,
  FILE_SENDING,
  FILE_SEGMENT_ERROR,
  FILE_TRANS_APP_TO_CAMERA,
  FILE_TRANS_CAMERA_TO_APP,
  FILE_TRANS_DELETE,

  ENCRYPT_CONFIG = 0x30,

  ACTIVATE_CONFIG = 0x32,
  MFI_CERT,
  SAFE_COMMUNICATION,

  FW_UPDATE_DESC_PUSH = 0x40,
  FW_UPDATE_PUSH_CONTROL,
  FW_UPGRADE_PUSH_STATUS,

  SLEEP_CONTROL = 0x45,
  SHUTDOWN_NOTIFICATION,
  POWER_STATE,
  LED_CONTROL,

  SET_DATE_TIME = 0x4a,
  GET_DATE_TIME,
  GET_MODULE_SYS_STATUS,
  SET_RT,
  GET_RT,
  GET_CFG_FILE,
  SET_SERIAL_NUMBER,
  GET_SERIAL_NUMBER,
  SET_GPS_PUSH_CONFIG,
  PUSH_GPS_INFO,
  GET_TEMPERATURE_INFO,
  GET_ALIVE_TIME,
  OVER_TEMPERATURE,
  SEND_NETWORK_INFO,
  TIME_SYNC,
  TEST_MODE,
  PLAY_SOUND,

  START_FTP = 0x5b,
  UAV_FLU_INFO = 0x5c,

  AUTO_TEST_INFO = 0x60,
  SET_PRODUCT_NEWEST_VERSION,
  GET_PRODUCT_NEWEST_VERSION,

  SEND_RESERVED_KEY = 0xef,

  LOG_PUSH = 0xf0,
  COMPONENT_SELF_TEST_STATE,
  LOG_CONTROL_GLOBAL,
  LOG_CONTROL_MODULE,
  TEST_START,
  TEST_STOP,
  TEST_QUERY_RESULT,
  PUSH_TEST_RESULT,
  GET_METADATA,

  LOG_CONTROL = 0xfa,
  SELF_TEST_STATE,
  SELF_TEST_STATE_COUNT,
  DUMP_FRAME_BUFFER,
  SELF_DEFINE,
  QUERY_DEVICE_INFO,
}

export enum SpecialTypes {
  SDK_CONTROL_NAV_MODE_TOGGLE,
  SPECIAL_APP_CONTROL_OLD,
  SPECIAL_REMOTE_CONTROL_OLD,
  SPECIAL_APP_CONTROL,
  SPECIAL_REMOTE_CONTROL,
  SDK_CONTROL_MODE_TOGGLE,

  SDK_CONTROL_GIMBAL_SPEED = 0x2a,
  SDK_CONTROL_GIMBAL_ANGLE,

  SDK_CONTROL_CAMERA_SHOT = 0x20,
  SDK_CONTROL_CAMERA_START_VIDEO,
  SDK_CONTROL_CAMERA_STOP_VIDEO,

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

export { Packet, DumlPacket } from './packet.js';
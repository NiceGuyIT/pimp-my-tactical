/**
 * A collection of Microsoft specific interfaces to consume ConvertTo-Json output.
 */

/**
 * Get-NetFirewallRule | ConvertTo-Json
 */
interface NetFirewallRule {
    CimClass: CimClass;
    CimInstanceProperties: CimInstanceProperties[];
    CimSystemProperties: CimSystemProperties;
    Name: string;
    ID: string;
    DisplayName: string;
    Group: string;
    Enabled: number;
    Profile: number;
    Platform: string[];
    Direction: number;
    Action: number;
    EdgeTraversalPolicy: number;
    LSM: boolean;
    PrimaryStatus: number;
    Status: string;
    EnforcementStatus: string;
    PolicyStoreSourceType: number;
    Caption: string | null;
    Description: string;
    ElementName: string;
    InstanceID: string;
    CommonName: string | null;
    PolicyKeywords: string | null;
    PolicyDecisionStrategy: number;
    PolicyRoles: string | null;
    ConditionListType: number;
    CreationClassName: string;
    ExecutionStrategy: number;
    Mandatory: string | null;
    PolicyRuleName: string;
    Priority: string | null;
    RuleUsage: string | null;
    SequencedActions: number;
    SystemCreationClassName: string;
    SystemName: string;
    DisplayGroup: string;
    LocalOnlyMapping: boolean;
    LooseSourceMapping: boolean;
    Owner: string | null;
    Platforms: string[];
    PolicyAppId: string | null;
    PolicyStoreSource: string;
    Profiles: number;
    RemoteDynamicKeywordAddresses: string[];
    RuleGroup: string;
    StatusCode: number;
    PSComputerName: string | null;
}

/**
 * Get-NetFirewallPortFilter | ConvertTo-Json
 */
interface NetFirewallPortFilter {
    CimClass: CimClass;
    CimInstanceProperties: CimInstanceProperties[];
    CimSystemProperties: CimSystemProperties;
    Protocol: string;
    LocalPort: string;
    RemotePort: string;
    IcmpType: string;
    DynamicTarget: number;
    DynamicTransport: number;
    Caption: string | null;
    Description: string | null;
    ElementName: string;
    InstanceID: string;
    CommunicationStatus: string | null;
    DetailedStatus: string | null;
    HealthState: string | null;
    InstallDate: string | null;
    Name: string;
    OperatingStatus: string | null;
    OperationalStatus: string | null;
    PrimaryStatus: string | null;
    Status: string | null;
    StatusDescriptions: string | null;
    CreationClassName: string;
    IsNegated: string | null;
    SystemCreationClassName: string;
    SystemName: string;
    PSComputerName: string | null;
}

/**
 * CimClass
 */
interface CimClass {
    CimSuperClassName: string;
    CimSuperClass: string;
    CimClassProperties: string;
    CimClassQualifiers: string;
    CimClassMethods: string;
    CimSystemProperties: string;
}

/**
 * CimInstanceProperties
 */
interface CimInstanceProperties {
    CimInstanceProperties: string[];
}

/**
 * CimSystemProperties
 */
interface CimSystemProperties {
    Namespace: string;
    ServerName: string;
    ClassName: string;
    Path: string | null;
}

/**
 * Get-ItemProperty | ConvertTo-Json
 * @property {number} AllowRemoteRPC
 * @property {number} DelayConMgrTimeout
 * @property {number} DeleteTempDirsOnExit
 * @property {number} fDenyTSConnections
 * @property {number} fSingleSessionPerUser
 * @property {number} NotificationTimeOut
 * @property {number} PerSessionTempDir
 * @property {string} ProductVersion
 * @property {array} RCDependentServices
 * @property {string} SnapshotMonitors
 * @property {number} StartRCM
 * @property {number} TSUserEnabled
 * @property {number} RailShowallNotifyIcons
 * @property {string} InstanceID
 * @property {number} GlassSessionId
 * @property {string} PSPath
 * @property {string} PSParentPath
 * @property {string} PSChildName
 * @property {object} PSDrive
 * @property {object} PSProvider
 */
interface ItemPropertyRegistry {
    /**
     * The rest of the properties are properties in the registry, not the object returned.
     */
    PSPath: string;
    PSParentPath: string;
    PSChildName: string;
    PSDrive: PSDrive;
    PSProvider: PSProvider;
}

/**
 * Get-ChildItem | ConvertTo-Json
 * Get-Item | ConvertTo-Json
 *
 * @property {number} SubKeyCount
 * @property {number} View
 * @property {object} Handle
 * @property {number} ValueCount
 * @property {string} Name
 * @property {array} Property
 * @property {string} PSPath
 * @property {string} PSParentPath
 * @property {string} PSChildName
 * @property {object} PSDrive
 * @property {object} PSProvider
 * @property {boolean} PSIsContainer
 */
interface ItemRegistry {
    SubKeyCount: number;
    View: number;
    Handle: Handle;
    ValueCount: number;
    Name: string;
    Property: string[];
    PSPath: string;
    PSParentPath: string;
    PSChildName: string;
    PSDrive: PSDrive;
    PSProvider: PSProvider;
    PSIsContainer: boolean;
}

/**
 * @property {boolean} IsInvalid
 * @property {boolean} IsClosed
 */
interface Handle {
    IsInvalid: boolean;
    IsClosed: boolean;
}

/**
 * @property {string} Name
 * @property {boolean} IsDefault
 * @property {string} ApplicationBase
 * @property {string} AssemblyName
 * @property {string} ModuleName
 * @property {string} PSVersion
 * @property {string} Version
 * @property {string} Types
 * @property {string} Formats
 * @property {string} Description
 * @property {string} Vendor
 * @property {boolean} LogPipelineExecutionDetails
 */
interface PSSnapIn {
    Name: string;
    IsDefault: boolean;
    ApplicationBase: string;
    AssemblyName: string;
    ModuleName: string;
    PSVersion: string;
    Version: string;
    Types: string;
    Formats: string;
    Description: string;
    Vendor: string;
    LogPipelineExecutionDetails: boolean;
}

/**
 * @property {string} CurrentLocation
 * @property {string} Name
 * @property {object} Provider
 * @property {string} Root
 * @property {string} Description
 * @property {*} MaximumSize
 * @property {object} Credential
 * @property {*} Credential.UserName
 * @property {*} Credential.Password
 * @property {*} DisplayRoot
 */
interface PSDrive {
    CurrentLocation: string;
    Name: string;
    Provider: Provider;
    Root: string;
    Description: string;
    MaximumSize: string | null;
    Credential: Credential;
    DisplayRoot: string | null;
}

/**
 * @property {*} UserName
 * @property {*} Password
 */
interface Credential {
    UserName: string | null;
    Password: string | null;
}

/**
 * @property {string} ImplementingType
 * @property {string} HelpFile
 * @property {string} Name
 * @property {string} PSSnapIn
 * @property {string} ModuleName
 * @property {*} Module
 * @property {string} Description
 * @property {number} Capabilities
 * @property {string} Home
 * @property {string} Drives
 */
interface Provider {
    ImplementingType: string;
    HelpFile: string;
    Name: string;
    PSSnapIn: string;
    ModuleName: string;
    Module: string | null;
    Description: string;
    Capabilities: number;
    Home: string;
    Drives: string;
}

/**
 * @property {object} ImplementingType
 * @property {string} HelpFile
 * @property {string} Name
 * @property {object} PSSnapIn
 * @property {string} ModuleName
 * @property {*} Module
 * @property {string} Description
 * @property {number} Capabilities
 * @property {string} Home
 * @property {array} Drives
 */
interface PSProvider {
    ImplementingType: ImplementingType;
    HelpFile: string;
    Name: string;
    PSSnapIn: PSSnapIn;
    ModuleName: string;
    Module: string | null;
    Description: string;
    Capabilities: number;
    Home: string;
    Drives: string[];
}

/**
 * @property {string} Module
 * @property {string} Assembly
 * @property {string} TypeHandle
 * @property {*} DeclaringMethod
 * @property {string} BaseType
 * @property {string} UnderlyingSystemType
 * @property {string} FullName
 * @property {string} AssemblyQualifiedName
 * @property {string} Namespace
 * @property {string} GUID
 * @property {boolean} IsEnum
 * @property {*} GenericParameterAttributes
 * @property {boolean} IsSecurityCritical
 * @property {boolean} IsSecuritySafeCritical
 * @property {boolean} IsSecurityTransparent
 * @property {boolean} IsGenericTypeDefinition
 * @property {boolean} IsGenericParameter
 * @property {*} GenericParameterPosition
 * @property {boolean} IsGenericType
 * @property {boolean} IsConstructedGenericType
 * @property {boolean} ContainsGenericParameters
 * @property {string} StructLayoutAttribute
 * @property {string} Name
 * @property {number} MemberType
 * @property {*} DeclaringType
 * @property {*} ReflectedType
 * @property {number} MetadataToken
 * @property {string} GenericTypeParameters
 * @property {string} DeclaredConstructors
 * @property {string} DeclaredEvents
 * @property {string} DeclaredFields
 * @property {string} DeclaredMembers
 * @property {string} DeclaredMethods
 * @property {string} DeclaredNestedTypes
 * @property {string} DeclaredProperties
 * @property {string} ImplementedInterfaces
 * @property {string} TypeInitializer
 * @property {boolean} IsNested
 * @property {number} Attributes
 * @property {boolean} IsVisible
 * @property {boolean} IsNotPublic
 * @property {boolean} IsPublic
 * @property {boolean} IsNestedPublic
 * @property {boolean} IsNestedPrivate
 * @property {boolean} IsNestedFamily
 * @property {boolean} IsNestedAssembly
 * @property {boolean} IsNestedFamANDAssem
 * @property {boolean} IsNestedFamORAssem
 * @property {boolean} IsAutoLayout
 * @property {boolean} IsLayoutSequential
 * @property {boolean} IsExplicitLayout
 * @property {boolean} IsClass
 * @property {boolean} IsInterface
 * @property {boolean} IsValueType
 * @property {boolean} IsAbstract
 * @property {boolean} IsSealed
 * @property {boolean} IsSpecialName
 * @property {boolean} IsImport
 * @property {boolean} IsSerializable
 * @property {boolean} IsAnsiClass
 * @property {boolean} IsUnicodeClass
 * @property {boolean} IsAutoClass
 * @property {boolean} IsArray
 * @property {boolean} IsByRef
 * @property {boolean} IsPointer
 * @property {boolean} IsPrimitive
 * @property {boolean} IsCOMObject
 * @property {boolean} HasElementType
 * @property {boolean} IsContextful
 * @property {boolean} IsMarshalByRef
 * @property {string} GenericTypeArguments
 * @property {string} CustomAttributes
 */
interface ImplementingType {
    Module: string;
    Assembly: string;
    TypeHandle: string;
    DeclaringMethod: string | null;
    BaseType: string;
    UnderlyingSystemType: string;
    FullName: string;
    AssemblyQualifiedName: string;
    Namespace: string;
    GUID: string;
    IsEnum: boolean;
    GenericParameterAttributes: string | null;
    IsSecurityCritical: boolean;
    IsSecuritySafeCritical: boolean;
    IsSecurityTransparent: boolean;
    IsGenericTypeDefinition: boolean;
    IsGenericParameter: boolean;
    GenericParameterPosition: string | null;
    IsGenericType: boolean;
    IsConstructedGenericType: boolean;
    ContainsGenericParameters: boolean;
    StructLayoutAttribute: string;
    Name: string;
    MemberType: number;
    DeclaringType: string | null;
    ReflectedType: string | null;
    MetadataToken: number;
    GenericTypeParameters: string;
    DeclaredConstructors: string;
    DeclaredEvents: string;
    DeclaredFields: string;
    DeclaredMembers: string;
    DeclaredMethods: string;
    DeclaredNestedTypes: string;
    DeclaredProperties: string;
    ImplementedInterfaces: string;
    TypeInitializer: string;
    IsNested: boolean;
    Attributes: number;
    IsVisible: boolean;
    IsNotPublic: boolean;
    IsPublic: boolean;
    IsNestedPublic: boolean;
    IsNestedPrivate: boolean;
    IsNestedFamily: boolean;
    IsNestedAssembly: boolean;
    IsNestedFamANDAssem: boolean;
    IsNestedFamORAssem: boolean;
    IsAutoLayout: boolean;
    IsLayoutSequential: boolean;
    IsExplicitLayout: boolean;
    IsClass: boolean;
    IsInterface: boolean;
    IsValueType: boolean;
    IsAbstract: boolean;
    IsSealed: boolean;
    IsSpecialName: boolean;
    IsImport: boolean;
    IsSerializable: boolean;
    IsAnsiClass: boolean;
    IsUnicodeClass: boolean;
    IsAutoClass: boolean;
    IsArray: boolean;
    IsByRef: boolean;
    IsPointer: boolean;
    IsPrimitive: boolean;
    IsCOMObject: boolean;
    HasElementType: boolean;
    IsContextful: boolean;
    IsMarshalByRef: boolean;
    GenericTypeArguments: string;
    CustomAttributes: string;
}

var viewType = 'default';       // view type
var viewMode = 'trigger';       // the type of connection the view type uses

var placesList     = '<option>underground</option><option>faeria</option><option>magika</option><option>underworld</option><option>hell</option><option>abyss</option><option>sky</option><option>kingdom</option><option>heaven</option><option>tarot</option><option>chaos</option>';
var spirits        = [];
var prevSaves      = [];
var toolLang       = 'EN';
var renderOptions  = { offsetX: 30, offsetY: 20 };



// connectionTypes and some default options for how they are displayed.
// Will be changed when jsPlumb is dropped

var connectionTypes = {
    parent:  { type: 'out', style: 'tree',       endpoint: { color: 'red' },   connector: { color: 'red',   width: 5 } },       // stored as an output
    display: { type: 'out', style: 'connector',  endpoint: { color: 'blue' },  connector: { color: 'blue',  width: 5 } },       // stored as an output
    unlock:  { type: 'in',  style: 'connector',  endpoint: { color: 'green' }, connector: { color: 'green', width: 5 } },       // stored as an input
    trigger: { type: 'out', style: 'connector',  endpoint: { color: 'teal' },  connector: { color: 'teal',  width: 5 } }        // stored as an output
};

var topLevelNodes = ['Campaign', 'Event', 'EventSection', 'Notification', 'GreeActivity'];

var definedViews = {
    default: {
        positionBy: 'display',
        connectors: {
            topDown: 'trigger',
            leftRight: 'display'
        }
    },
    unlock: {
        positionBy: 'unlock',
        connectors: {
            topDown: 'unlock',
            leftRight: 'display'
        }
    }
};

var anchors = {
    display: "horizontal",
    trigger: "vertical",
    unlock:  "vertical",
    parent:  "vertical"
};


// array, first value is display logic, second value is traverse logic

var traverseType = {
    Container:         'display',
    Campaign:          'display',
    Stage:             'display',
    Area:              'display',
    Quest:             'display',
    Section:           'display',
    Event:             'trigger',
    BonusSection:      'trigger',
    EventSection:      'trigger',
    SectionDone:       'trigger',
    SectionBattle:     'trigger',
    SectionChat:       'trigger',
    SectionCardBonus:  'trigger',
    SectionReward:     'trigger',
    SectionAbort:      'trigger',
    SectionCapture:    'trigger',
    SectionCutscene:   'trigger',
    SectionBoss:       'trigger',
    SectionPvpBattle:  'trigger',
    SectionPopup:      'trigger',
    SectionScenario:   'trigger',
    UseUpgradePoints:  'trigger'
};

var traverseNodes = [];

for (var type in traverseType) {
    if(traverseType[type] == 'trigger') {
        traverseNodes.push(type);
	}
}


var viewTypes = {
    'default': {
        default:           ['trigger', 'trigger'],
        Container:         ['display', 'display'],
        Campaign:          ['display', 'display'],
        Stage:             ['display', 'display'],
        Area:              ['display', 'display'],
        Quest:             ['display', 'display'],
        Section:           ['trigger', 'display'],
        BonusSection:      ['trigger', 'display'],
        EventSection:      ['trigger', 'display'],
        SectionDone:       ['trigger', 'trigger'],
        SectionBattle:     ['trigger', 'trigger'],
        SectionChat:       ['trigger', 'trigger'],
        SectionCardBonus:  ['trigger', 'trigger'],
        SectionReward:     ['trigger', 'trigger'],
        SectionAbort:      ['trigger', 'trigger'],
        SectionCapture:    ['trigger', 'trigger'],
        SectionCutscene:   ['trigger', 'trigger'],
        SectionBoss:       ['trigger', 'trigger'],
        SectionPvpBattle:  ['trigger', 'trigger'],
        SectionPopup:      ['trigger', 'trigger'],
        SectionScenario:   ['trigger', 'trigger'],
        UseUpgradePoints:  ['trigger', 'trigger']
    },
    'display': {
        display:           ['display', 'display'],
        Container:         ['display', 'display'],
        Campaign:          ['display', 'display'],
        Stage:             ['display', 'display'],
        Area:              ['display', 'display'],
        Quest:             ['display', 'display'],
        Section:           ['display', 'display'],
        BonusSection:      ['display', 'display'],
        EventSection:      ['display', 'display'],
        SectionDone:       ['display', 'display'],
        SectionBattle:     ['display', 'display'],
        SectionChat:       ['display', 'display'],
        SectionCardBonus:  ['display', 'display'],
        SectionReward:     ['display', 'display'],
        SectionAbort:      ['display', 'display'],
        SectionCapture:    ['display', 'display'],
        SectionCutscene:   ['display', 'display'],
        SectionBoss:       ['display', 'display'],
        SectionPvpBattle:  ['display', 'display'],
        SectionPopup:      ['display', 'display'],
        SectionNarration:  ['display', 'display'],
        SectionScenario:   ['display', 'display']
    },
    'unlock': {
        unlock:            ['unlock', 'unlock'],
        Container:         ['unlock', 'unlock'],
        Campaign:          ['unlock', 'unlock'],
        Stage:             ['unlock', 'unlock'],
        Area:              ['unlock', 'unlock'],
        Quest:             ['unlock', 'unlock'],
        Section:           ['unlock', 'unlock'],
        BonusSection:      ['unlock', 'unlock'],
        EventSection:      ['unlock', 'unlock'],
        SectionDone:       ['unlock', 'unlock'],
        SectionBattle:     ['unlock', 'unlock'],
        SectionChat:       ['unlock', 'unlock'],
        SectionCardBonus:  ['unlock', 'unlock'],
        SectionReward:     ['unlock', 'unlock'],
        SectionAbort:      ['unlock', 'unlock'],
        SectionCapture:    ['unlock', 'unlock'],
        SectionCutscene:   ['unlock', 'unlock'],
        SectionBoss:       ['unlock', 'unlock'],
        SectionPvpBattle:  ['unlock', 'unlock'],
        SectionPopup:      ['unlock', 'unlock'],
        SectionNarration:  ['unlock', 'unlock'],
        SectionScenario:   ['unlock', 'unlock']
    },
    'trigger': {
        trigger:           ['trigger', 'trigger'],
        Container:         ['trigger', 'trigger'],
        Campaign:          ['trigger', 'trigger'],
        Stage:             ['trigger', 'trigger'],
        Area:              ['trigger', 'trigger'],
        Quest:             ['trigger', 'trigger'],
        Section:           ['trigger', 'trigger'],
        BonusSection:      ['trigger', 'trigger'],
        EventSection:      ['trigger', 'trigger'],
        SectionDone:       ['trigger', 'trigger'],
        SectionBattle:     ['trigger', 'trigger'],
        SectionChat:       ['trigger', 'trigger'],
        SectionCardBonus:  ['trigger', 'trigger'],
        SectionReward:     ['trigger', 'trigger'],
        SectionAbort:      ['trigger', 'trigger'],
        SectionCapture:    ['trigger', 'trigger'],
        SectionCutscene:   ['trigger', 'trigger'],
        SectionBoss:       ['trigger', 'trigger'],
        SectionPvpBattle:  ['trigger', 'trigger'],
        SectionPopup:      ['trigger', 'trigger'],
        SectionNarration:  ['trigger', 'trigger'],
        SectionScenario:   ['trigger', 'trigger']
    }
};

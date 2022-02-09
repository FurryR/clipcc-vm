// extension-api.js
const ScratchBlocksConstants = require('../engine/scratch-blocks-constants');
const xmlEscape = require('../util/xml-escape');
const maybeFormatMessage = require('../util/maybe-format-message');
const formatMessage = require('format-message');

const blockType = [
    '', // ERROR: 0
    'command', // COMMAND: 1
    'reporter', // REPORTER: 2
    'Boolean', // BOOLEAN: 3
    '', // BRANCH: 4
    'hat' // HAT: 5
];

const argumentType = [
    '', // ERROR: 0
    'number', // NUMBER: 1
    'string', // STRING: 2
    'Boolean', // BOOLEAN: 3
    'any', // ANY: 4
    'color', // COLOR: 5
    'matrix', // MATRIX: 6
    'note', // NOTE: 7
    'angle' // ANGLE: 8
];

class ExtensionAPI {
    constructor (vm) {
        this.vm = vm;
        this.categorys = [];
        this.blocks = [];
        // console.log("ExtensionAPI已加载！",this.vm, this.blockly);//DEBUG
    }

    _getCategory (categoryId) {
        for (const category of this.vm.runtime._blockInfo) {
            if (category.id === categoryId) {
                return category;
            }
        }
        // TODO: Error throw
    }

    _generateBlockInfo (block) {
        const paramInfo = {};
        for (const name in block.param) {
            paramInfo[name] = {
                type: argumentType[block.param[name].type],
                defaultValue: block.param[name].default || '',
                shadow: block.param[name].shadow
            };
        }
        return {
            opcode: block.opcode,
            func: block.function,
            blockType: blockType[block.type],
            messageId: block.messageId,
            text: formatMessage({
                id: block.messageId,
                default: block.messageId
            }),
            arguments: paramInfo
        };
    }

    refreshBlocks () {
        return new Promise((resolve, reject) => {
            for (const i in this.categorys) {
                this.categorys[i].name = formatMessage({
                    id: this.categorys[i].messageId,
                    default: this.categorys[i].messageId
                });
                console.log(this.categorys[i]);
                for (const j in this.categorys[i].blocks) {
                    this.categorys[i].blocks[j].info.text = formatMessage({
                        id: this.categorys[i].blocks[j].info.messageId,
                        default: this.categorys[i].blocks[j].info.messageId
                    });
                    // Regen json info
                    const blockInfo = this.categorys[i].blocks[j].info;
                    const blockJSON = this.categorys[i].blocks[j].json;
                    const context = {
                        argsMap: {},
                        blockJSON,
                        categoryInfo: this.categorys[i],
                        blockInfo,
                        inputList: []
                    };
                    const blockText = Array.isArray(blockInfo.text) ? blockInfo.text : [blockInfo.text];
                    const convertPlaceholders = this.vm.runtime._convertPlaceholders.bind(this.vm.runtime, context);
                    let inTextNum = 0;
                    let inBranchNum = 0;
                    let outLineNum = 0;
                    while (inTextNum < blockText.length || inBranchNum < blockInfo.branchCount) {
                        if (inTextNum < blockText.length) {
                            context.outLineNum = outLineNum;
                            const lineText = maybeFormatMessage(blockText[inTextNum]);
                            blockJSON[`args${outLineNum}`] = [];
                            const convertedText = lineText.replace(/\[(.+?)]/g, convertPlaceholders);
                            blockJSON[`message${outLineNum}`] = convertedText;
                            ++inTextNum;
                            ++outLineNum;
                        }
                        if (inBranchNum < blockInfo.branchCount) {
                            blockJSON[`message${outLineNum}`] = '%1';
                            blockJSON[`args${outLineNum}`] = [{
                                type: 'input_statement',
                                name: `SUBSTACK${inBranchNum > 0 ? inBranchNum + 1 : ''}`
                            }];
                            ++inBranchNum;
                            ++outLineNum;
                        }
                    }
                    console.log(this.categorys[i].blocks[j]);
                }
                this.vm.runtime.emit('BLOCKSINFO_UPDATE', this.categorys[i]);
            }
            resolve();
        });
    }

    addBlock (block) {
        try {
            const category = this._getCategory(block.categoryId);
            const blockJSON = {
                type: block.opcode,
                inputsInline: true,
                category: category.name,
                colour: category.color1,
                colourSecondary: category.color2,
                colourTertiary: category.color3
            };
            const blockInfo = this._generateBlockInfo(block);
            const context = {
                argsMap: {},
                blockJSON,
                categoryInfo: category,
                blockInfo,
                inputList: []
            };

            // TODO: Show icon before block

            switch (block.type) {
            case 1: // COMMAND
                blockJSON.outputShape = ScratchBlocksConstants.OUTPUT_SHAPE_SQUARE;
                blockJSON.previousStatement = null;
                if (!block.isTerminal) {
                    blockJSON.nextStatement = null;
                }
                break;
            case 2: // REPORTER
                blockJSON.output = 'String';
                blockJSON.outputShape = ScratchBlocksConstants.OUTPUT_SHAPE_ROUND;
                break;
            case 3: // BOOLEAN
                blockJSON.output = 'Boolean';
                blockJSON.outputShape = ScratchBlocksConstants.OUTPUT_SHAPE_HEXAGONAL;
                break;
            case 4: // BRANCH
                // TODO: Block with branch
                break;
            case 5: // HAT
                // blockInfo.isEdgeActivated = block.isEdgeActivated;
                if (!blockInfo.isEdgeActivated) {
                    blockInfo.isEdgeActivated = true;
                }
                blockJSON.outputShape = ScratchBlocksConstants.OUTPUT_SHAPE_SQUARE;
                blockJSON.nextStatement = null;
                break;
            default:
            // TODO: Error, unknown
                break;
            }
            // TODO: Alternate between a block "arm" with text on it and an open slot for a substack
            // engine/runtime.js: line 1145-1167
            const blockText = Array.isArray(blockInfo.text) ? blockInfo.text : [blockInfo.text];
            const convertPlaceholders = this.vm.runtime._convertPlaceholders.bind(this.vm.runtime, context);
            let inTextNum = 0;
            let inBranchNum = 0;
            let outLineNum = 0;
            console.log(context);
            while (inTextNum < blockText.length || inBranchNum < blockInfo.branchCount) {
                if (inTextNum < blockText.length) {
                    context.outLineNum = outLineNum;
                    const lineText = maybeFormatMessage(blockText[inTextNum]);
                    console.log(1, lineText);
                    const convertedText = lineText.replace(/\[(.+?)]/g, convertPlaceholders);
                    if (blockJSON[`message${outLineNum}`]) {
                        blockJSON[`message${outLineNum}`] += convertedText;
                    } else {
                        blockJSON[`message${outLineNum}`] = convertedText;
                    }
                    ++inTextNum;
                    ++outLineNum;
                }
                if (inBranchNum < blockInfo.branchCount) {
                    blockJSON[`message${outLineNum}`] = '%1';
                    blockJSON[`args${outLineNum}`] = [{
                        type: 'input_statement',
                        name: `SUBSTACK${inBranchNum > 0 ? inBranchNum + 1 : ''}`
                    }];
                    ++inBranchNum;
                    ++outLineNum;
                }
            }

            // Monitor of a repoter
            // add iff there is no input and hasMonitor is set
            if (block.type == 2) { // REPORTER
                if (context.inputList.length === 0 && block.hasMonitor) {
                    blockJSON.checkboxInFlyout = true;
                }
            }

            // TODO: Icon of loop block
            // engine/runtime.js: line 1173-1186

            const mutation = blockInfo.isDynamic ? `<mutation blockInfo="${xmlEscape(JSON.stringify(blockInfo))}"/>` : '';
            const inputs = context.inputList.join('');
            const blockXML = `<block type="${block.opcode}">${mutation}${inputs}</block>`;

            const convertedBlock = {
                info: context.blockInfo,
                json: context.blockJSON,
                xml: blockXML
            };

            category.blocks.push(convertedBlock);
            if (convertedBlock.json) {
                const opcode = convertedBlock.json.type;
                this.vm.runtime._primitives[opcode] = convertedBlock.info.func;
                if (block.type === 5) {
                    // TODO: shouldRestartExistingThreads ?
                    // TODO: edgeActivated ?
                    this.vm.runtime._hats[opcode] = {
                        edgeActivated: blockInfo.isEdgeActivated
                    };
                }
            }

            this.blocks.push(blockInfo);
            this.vm.emit('BLOCKSINFO_UPDATE', category);
        } catch (e) {
            console.error(e);
            return;
        }
    }

    removeBlock (blockId) {
        for (const i in this.vm.runtime._blockInfo) {
            const category = this.vm.runtime._blockInfo[i];
            for (const j in category.blocks){
                // console.log(category.blocks[j])
                if (category.blocks[j].info.opcode === blockId) {
                    this.vm.runtime._blockInfo[i].blocks.splice(j, 1);
                    // console.log("blocks found!", blockId, this.vm.runtime._blockInfo[i].blocks[j]);
                    this.vm.emit('BLOCK_REMOVED', blockId);
                }
            }
        }
        this.refreshBlocks();
        console.log('Remove a block', blockId);
    }

    addCategory (category) {
        const categoryInfo = {
            id: category.categoryId,
            messageId: category.messageId,
            name: formatMessage({
                id: category.messageId,
                default: category.messageId
            }),
            showStatusButton: category.showStatusButton,
            color1: category.color || '#0FBD8C',
            blocks: [],
            customFieldTypes: {},
            menus: [],
            menuInfo: {}
        };

        this.categorys.push(categoryInfo);
        console.log('Add a category', category);
        this.vm.runtime._blockInfo.push(categoryInfo);
        this.vm.emit('EXTENSION_ADDED', categoryInfo);
    }

    removeCategory (categoryId) {
        for (const i in this.vm.runtime._blockInfo) {
            const category = this.vm.runtime._blockInfo[i];
            if (category.id === categoryId) {
                this.vm.runtime._blockInfo.splice(i, 1);
                this.vm.emit('EXTENSION_REMOVED', categoryId);
            }
        }
        this.refreshBlocks();
        console.log('Remove a category', categoryId);
    }

    getPlaygroundData () {
        return this.vm.getPlaygroundData();
    }

    loadProject (input) {
        return this.vm.loadProject(input);
    }
}

module.exports = ExtensionAPI;

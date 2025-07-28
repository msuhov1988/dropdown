"use strict"

/*  Подключаемый выпадающий список.
    Создайте обработчик на требуемом элементе и вызовите метод .open(masterElem, value) данного компонента.
       Первый аргумент - требуемый html элемент. 
       Значение передается во втором аргументе для того, чтобы была возможность сохранять исходные типы данных или проводить дополнительные обработки.
    Генерирует события:
       attachSelect - при выборе опции, event = {bubbles: true, detail: {element: masterElem, muliple: this.multiple, value: this.selection, option}}
       attachReset - при сбросе, event = {bubbles: true, detail: {element: masterElem, muliple: this.multiple, value: this.selection}}
    Поддерживает:
       Фильтрация опций при вводе во внутренний элемент input
       Ленивая отрисовка опций
       Скролллинг по опциям как мышью, так и клавиатурой
       Выбор опций как мышью, так и клавиатурой (enter)
*/

class AttachDropError extends Error {
    constructor(message) {
        super(message);
        this.name = "AttachDropError";
    }
}

// данные компонента -  это массив вида: [ { label: _, value: _ }, ...]
const InspectFunctions = {
    checkOptions(optionsArray) {
        if (!Array.isArray(optionsArray)) {throw new AttachDropError("InspectFunctions - collection of options must be an ARRAY")} 
        optionsArray.forEach((option, i) => {            
                if (Object.prototype.toString.call(option) !== '[object Object]') {
                    throw new AttachDropError(`InspectFunctions - ${option} at index ${i} - must be an OBJECT`);    
                }
                if (!("label" in option) || !("value" in option)) {
                    throw new AttachDropError(`InspectFunctions - ${option} at index ${i} - must contain 'label' and 'value' properties`);
                }                
            }
        )
    },    
}

function filtering(optionsArray, preparedLabels) {
    let [_optionsArray, _preparedLabels] = [optionsArray, preparedLabels];   
    let [_lastInput, _previousResult, _previousIndexes] = [null, [], []];    
    function filteringInner(inputArg) {            
        if (!inputArg) {
            [_lastInput, _previousResult, _previousIndexes] = [null, [], []];                
            return _optionsArray
        }
        const input = inputArg.toLowerCase();        
        if (input === _lastInput) { return _previousResult }
        const getLabel = (_preparedLabels) ? index => _preparedLabels[index] : index => String(_optionsArray[index].label).toLowerCase();                     
        if (input.slice(0, -1) === _lastInput) {
            _previousIndexes = _previousIndexes.filter(index => getLabel(index).includes(input));
        } else {
            _previousIndexes = [];
            _optionsArray.forEach((_, index) => { if (getLabel(index).includes(input)) {_previousIndexes.push(index)} });
        }
        _lastInput = input;
        _previousResult = _previousIndexes.map(index => _optionsArray[index]);
        return _previousResult

    }
    return filteringInner
}

function forRendering(dataSlice, startIndex) {        
    return dataSlice.map(({label, value}, index) => ({label, value, index: startIndex + index}))    
} 

function GetForRendering(optionsArray, preparedLabels) {
    let [_optionsArray, _preparedLabels] = [optionsArray, preparedLabels];
    let _filteredData = [];
    let filterFunc = filtering(optionsArray, preparedLabels);

    return {
        updateState(newOptions, newLabels) {
            _optionsArray = newOptions;
            _preparedLabels = newLabels;
            _filteredData = [];
            filterFunc = filtering(newOptions, newLabels);
        },        

        forOpen({outerValue, quantity}) {
            // outerValue - всегда массив(для single mode - массив из одного элемента)            
            _filteredData = filterFunc(null);                                  
            let index = _filteredData.findIndex(obj => obj.value === outerValue.slice(-1)[0]);            
            if (index === -1) { index = 0 }                      
            const startIndex = Math.min(index, Math.max(0, _filteredData.length - quantity + 1));            
            const dataSlice = _filteredData.slice(startIndex, startIndex + quantity);
            return [forRendering(dataSlice, startIndex), startIndex, _filteredData.length];
        },
    
        forFilter({inputText, quantity}) {
            _filteredData = filterFunc(inputText);        
            const dataSlice = _filteredData.slice(0, quantity); 
            return [forRendering(dataSlice, 0), _filteredData.length];
        },

        forScroll({startIndex, quantity}) {
            const dataSlice = _filteredData.slice(startIndex, startIndex + quantity);
            return forRendering(dataSlice, startIndex);     
        },

        forKeyboard({startIndex, endIndex, selectedValue, down}) {
            /* циклический поиск первой невыбранной опции, в зависимости от направления (стрелка на клавиатуре) 
               после нахождения рассчитываем смещение относительно индексов крайних элементов в отрисованном контейнере
               формируем новый список опций для отрисовки в контейнере
               selectedValue - всегда массив
            */
            let [data, index] = [_filteredData, null];        
            if (down) {
                index = data.slice(endIndex + 1, data.length).findIndex(({value}) => !selectedValue.includes(value));            
                if (index !== - 1) { index = index + endIndex + 1 }        
                else { index = data.slice(0, startIndex).findIndex(({value}) => !selectedValue.includes(value)) }            
            } else {
                index = data.slice(0, startIndex).findLastIndex(({value}) => !selectedValue.includes(value));            
                if (index === - 1) { 
                    index = data.slice(endIndex + 1, data.length).findLastIndex(({value}) => !selectedValue.includes(value));
                    if (index !== - 1) { index = index + endIndex + 1 }                 
                }                                 
            }        
            if (index === -1) { return {circle: true} }
            const [shift, hoverFirst] = (index < startIndex) ? [index - startIndex, true] : [index - endIndex, false];
            const [newStartInd, newEndInd] = [startIndex + shift, endIndex + shift + 1];
            const dataSlice = data.slice(newStartInd, newEndInd);
            const forRender = forRendering(dataSlice, newStartInd);                               
            return {forRender: forRender, hoverFirst: hoverFirst, newStartInd: newStartInd, scrollShift: shift}        
        },    
    
        valueByIndex(index) {            
            if (Number.isInteger(index) && index >= 0 && index < _filteredData.length) {
                const option = _filteredData[index];
                const value = option.value;
                return {success: true, value: value, option: option} }
            else { return {success: false} } 
        },
    }
}

class DataManager {
    static getFormattedLabels(optionsArray) { return optionsArray.map(obj => String(obj.label).toLowerCase()) } 
    
    constructor({optionsArray, fastFilterMode}) {       
        this._data = null;        
        this._fastFilterMode = null; 
        
        const {updateState, forOpen, forFilter, forScroll, forKeyboard, valueByIndex} = GetForRendering(null, null);
        this.updateState = updateState;        
        this.getDataForOpen = forOpen
        this.getDataForFilter = forFilter  
        this.getDataForScroll = forScroll   
        this.getDataForKeyboard = forKeyboard
        this.getValueByIndex = valueByIndex
        
        this.data = optionsArray;              
        this.fastFilterMode = fastFilterMode;      
    }

    get data() {return this._data}
    set data(optionsArray) {                         
        this._data = optionsArray;                    
        const preparedLabels = (this._fastFilterMode) ? DataManager.getFormattedLabels(optionsArray) : null;
        this.updateState(optionsArray, preparedLabels);       
    }

    get fastFilterMode() { return this._fastFilterMode }
    set fastFilterMode(value) {                     
        let newMode = (value === "false" || !value) ? false : true;
        if (newMode !== this._fastFilterMode) {
            this._fastFilterMode = newMode;                                  
            const preparedLabels = (newMode) ? DataManager.getFormattedLabels(this._data) : null;
            this.updateState(this._data, preparedLabels);                          
        }            
    }
}


function MasterElemLogic() {
    // здесь собраны все функции для позиционирования компонента относительно элемента, на котором он вызывается
    let [top, bottom, left, right, width] = [null, null, null, null, null];
    let [windowHeight, windowWidth, scrollX, scrollY] = [null, null, null, null];
    let element = null;

    return {
        updateState(masterElem) {
            if (!masterElem) { throw new AttachDropError("masterElem must be a valid html element") }
            ({top, bottom, left, right} = masterElem.getBoundingClientRect());
            width = masterElem.offsetWidth;
            [windowHeight, windowWidth] = [document.documentElement.clientHeight, document.documentElement.clientWidth]; // без полос прокрутки, если они есть 
            [scrollX, scrollY] = [window.scrollX, window.scrollY];
            element = masterElem;            
        },
        
        positionToLeftUp(container, containerWidth) {                   
            container.style.top = `${top + scrollY + 2}px`;
            container.style.left = `${left + width - containerWidth - 2 + scrollX}px`;     
        },

        alignmentVertical(container, heightForCalculation) {                           
            const [overflowDown, overflowUp] = [bottom + heightForCalculation + 100 > windowHeight, top - heightForCalculation < 0]; // + 100 - запас высоты на input блок                           
            if (overflowDown && !overflowUp) {
                container.style.bottom = `${windowHeight - top - scrollY + 1}px`;
                container.style.top = '';
            } else {
                container.style.top = `${bottom + scrollY + 1}px`;
                container.style.bottom = '';
            }          
        },

        alignmentHorizontal(container, stretchCoeff) {
            const stretchWidth = width * stretchCoeff;
            const overflowRight = left + stretchWidth > windowWidth;
            if (overflowRight) {
                container.style.right = `${windowWidth - right - scrollX}px`;
                container.style.left = '';            
            } else {
                container.style.left = `${left + scrollX}px`;
                container.style.right = '';
            }          
        },

        defineWidth(container, stretchCoeff) { container.style.width = `${width * stretchCoeff}px` },
        
        getMasterElement() { return element },
    }
}


const CSS_CLASSES = {
    unselectedText: "unselected",    
    contentClass: "option-base",
    hoveredClass: "option-hovered",
    selectedClass: "option-selected", 
    emptyClass: "option-empty"
} 

const MAIN_TEMPLATE = document.createElement('template');
MAIN_TEMPLATE.innerHTML = `
    <style>       
        .${CSS_CLASSES.unselectedText} {
            -webkit-touch-callout: none;
            -webkit-user-select  : none;
            -khtml-user-select   : none;
            -moz-user-select     : none;
            -ms-user-select      : none;
            -o-user-select       : none;
            user-select          : none;  
        }
        .${CSS_CLASSES.contentClass} {
            display:     block;
            box-sizing:  border-box;            
            padding:     5px 5px 5px 10px;            
            width:       100%;
            overflow:    hidden;        
            white-space: normal;
            cursor:      pointer;   
            background-color: var(--option-background);
            color:            var(--option-color, rgb(16, 24, 40));
            font-family:      var(--option-font-family, inherit);          
            font-size:        var(--option-font-size, 14px);  
            font-weight:      var(--option-font-weight, normal); 
            border-radius:    var(--option-border-radius, 4px);          
        }
        .${CSS_CLASSES.hoveredClass} {
            background-color: var(--option-hover-background, rgba(88, 93, 105, 0.1));
            color:            var(--option-hover-color, rgb(16, 24, 40));
        }
        .${CSS_CLASSES.selectedClass} {
            background-color: var(--option-select-background, rgba(255, 79, 18, 0.1));
            color:            var(--option-select-color, rgb(255, 114, 65));}
        .${CSS_CLASSES.emptyClass} {        
            cursor:  default;
        }
            
        .delete-block {
            box-sizing: border-box;                 
            position: absolute;            
            z-index: 1;
            display: none;
            align-items: center;
            justify-content: center;           
            border-radius: 4px;
            color:            var(--delete-color);
            background-color: var(--delete-background, transparent); 
            cursor: pointer;                   
        }        
        .delete-symb {font-size: var(--delete-font-size, 12px);}
        .delete-block:hover {
            color:            var(--delete-hover-color, white);
            background-color: var(--delete-hover-background, rgb(255, 81, 81));
        }

        .drop {            
            box-sizing: border-box;                 
            position: absolute;            
            z-index:          var(--drop-z-index, 99);             
            width: 100%; 
            text-align: left;                         
            background-color: var(--drop-background, white); 
            border:           var(--drop-border);
            border-radius:    var(--drop-border-radius, 6px);  
            box-shadow:       var(--drop-box-shadow, 0px 0px 6px 0px rgba(34, 60, 80, 0.4));   
        }       

        .input-wrapper {margin: 15px 10px 0px 10px; border-bottom: var(--input-border-bottom, 1px solid rgb(181, 183, 192));}
        input {           
            width: 100%;                                       
            outline: none; 
            border: 0;
            background-color: var(--input-background-color, inherit);            
            color:            var(--input-color, rgb(16, 24, 40));
            font-family:      var(--input-font-family, inherit); 
            font-size:        var(--input-font-size, inherit);
            font-weight:      var(--input-font-weight, inherit);                               
        }  
        input::placeholder {
            color:       var(--input-placeholder-color, rgb(181, 183, 192));
            font:        var(--input-placeholder-font, inherit); 
            font-size:   var(--input-placeholder-font-size, 14px);
            font-weight: var(--input-placeholder-font-weight, normal);    
        }

        .scroll-container {            
            margin: 20px 5px 0px 5px;
            overflow-y: auto;           
        } 
        .height-container {
            position: relative;
            box-sizing: border-box;            
            width: 100%; }
        .content-container {position: absolute; width: 100%;}
        .footer-container {height: 10px;}
        
        .scroll-container {
            scrollbar-width: thin;           
        }                             
    </style>         
          
    <div class="delete-block">
        <span class="delete-symb">\u{2716}</span>
    </div>
    <div class="drop" hidden>
        <div class="input-wrapper">                             
            <input type="text"></input>  
        </div>      
        <div class="scroll-container">
            <div class="height-container">
                <div class="content-container"></div>
            </div>
        </div>  
        <div class="footer-container"></div>  
    </div>    
`;

class OptionManager {
    // класс для управления отрисованными опциями в контейнере       
    constructor() {
        this.template = null;
        this.templateForeign = null; 
        this.hoveredElement = null;
    }

    markAsEmpty(optionElem) { optionElem.classList.add(CSS_CLASSES.emptyClass) }

    isEmpty(optionElem) { return optionElem.classList.contains(CSS_CLASSES.emptyClass) }      
    
    markAsSelected(optionElem) { optionElem.classList.add(CSS_CLASSES.selectedClass) }

    unmarkAsSelected(optionElem) { optionElem.classList.remove(CSS_CLASSES.selectedClass) }

    isSelected(optionElem) { return optionElem.classList.contains(CSS_CLASSES.selectedClass) }

    markAsHovered(optionElem) { optionElem.classList.add(CSS_CLASSES.hoveredClass) }

    unmarkHovered(optionElem) { optionElem.classList.remove(CSS_CLASSES.hoveredClass) }

    createTemplate(height) {
        const template = document.createElement('template');
        template.innerHTML = `<span class="${CSS_CLASSES.unselectedText} ${CSS_CLASSES.contentClass}" style="height: ${height}px;"></span>`;
        this.template = template;
    }  
    
    createTemplateByForeignFunc(height) {
        const template = document.createElement('template');
        template.innerHTML = `<div class="${CSS_CLASSES.unselectedText} ${CSS_CLASSES.contentClass}" style="height: ${height}px;"></div>`;
        this.templateForeign = template;    
    }

    _createEmptyFragment() {      
        const fragment = this.template.content.cloneNode(true);
        const optionElem = fragment.firstElementChild;             
        this.markAsEmpty(optionElem);               
        return fragment  
    }
    
    createOptions({dataForRender, selectedValue, templateCreator}) {        
        // selectedValue - всегда массив
        this.hoveredElement = null;        
        if (dataForRender.length === 0) { return this._createEmptyFragment() }            
        const fragment = document.createDocumentFragment();
        dataForRender.forEach(option => {
            const {label, value, index} = option;
            let [optionFragment, optionElem] = [null, null];
            if (templateCreator) {
                optionFragment = this.templateForeign.content.cloneNode(true);
                optionElem = optionFragment.firstElementChild;                                             
                optionElem.append(templateCreator(option));                             
            } else {
                optionFragment = this.template.content.cloneNode(true);
                optionElem = optionFragment.firstElementChild;
                optionElem.textContent = label;
            }            
            optionElem.dataset.index = index;           
            if (selectedValue.includes(value)) { this.markAsSelected(optionElem) } 
            optionElem.setAttribute('role', 'option');                                       
            fragment.append(optionFragment);    
        })                    
        return fragment   
    } 
    
    _findAncestorOption(element) {
        let current = element;
        while (current) {
          if (current.classList && current.classList.contains(CSS_CLASSES.contentClass)) {
            return current
          }
          current = current.parentElement;
        }
        return null
      }
             
    applyHoverToOption(optionElem) {
        const maybeOption = this._findAncestorOption(optionElem);
        if (!maybeOption) { return {success: false} }
        let success = false;        
        if (this.hoveredElement) {
            this.unmarkHovered(this.hoveredElement);
            this.hoveredElement = null;            
        }      
        if (maybeOption && !this.isEmpty(maybeOption) && !this.isSelected(maybeOption)) {
            this.markAsHovered(maybeOption);
            this.hoveredElement = maybeOption;
            success = true;
        }
        return {success, hovered: this.hoveredElement}
    }

    optionIsPartialyHidden(optionElem, containerScroll) {
        // определяем, что опция в списке видна частично
        const elementPosition = optionElem.getBoundingClientRect();
        const containerPosition = containerScroll.getBoundingClientRect(); 
        if (containerPosition.top > elementPosition.top) {
            return {hidden: true, onTop: true}
        } else if (elementPosition.bottom > containerPosition.bottom) {
            return {hidden: true, onTop: false}
        } 
        return {hidden: false}     
    }    

    keyBoardSwitch(container, down) {
        /* поиск следующей подходящей опции в пределах контейнера в зависимости от направления (стрелка на клавиатуре)
           если не найдена - предполагается дальнейший поиск в компоненте, отвечающем за обработку данных
        */
        const children = Array.from(container.children);
        let currentInd = children.indexOf(this.hoveredElement);
        if (currentInd === -1) { currentInd = (down) ? -1 : children.length }        
        const incrementFunc = (down) ? () => currentInd += 1 : () => currentInd -= 1;
        const decrementFunc = (down) ? () => currentInd -= 1 : () => currentInd += 1;               
        while (true) {
            incrementFunc();
            const optionElem = children[currentInd];
            if (!optionElem) {
                decrementFunc();
                const [startOption, endOption, lastOption] = [children[0], children[children.length - 1], children[currentInd]];                
                const [startIndex, endIndex] = [Number(startOption.dataset.index), Number(endOption.dataset.index)];
                return {option: lastOption, startIndex: startIndex, endIndex: endIndex}
            }                  
            if (this.isSelected(optionElem) || this.isEmpty(optionElem)) { continue }
            if (this.hoveredElement) { this.unmarkHovered(this.hoveredElement) }
            this.markAsHovered(optionElem);
            this.hoveredElement = optionElem;
            return {option: optionElem}
        }             
    }

    rewriteOptions({container, forRender, hoverFirst, selectedValue, templateCreator}) { 
        // selectedValue - всегда массив
        const children = Array.from(container.children);
        forRender.forEach(({label, value, index}, i) => {            
            const optionElem = children[i];                  
            optionElem.dataset.index = index; 
            if (!templateCreator) { optionElem.textContent = label }
            else {                 
                optionElem.innerHTML = null;
                optionElem.append(templateCreator({label, value}));                
            }            
            const dataIsSelected = (selectedValue.includes(value));
            const optionIsSelected = this.isSelected(optionElem);
            if (dataIsSelected && !optionIsSelected) { this.markAsSelected(optionElem) }
            else if (!dataIsSelected && optionIsSelected) { this.unmarkAsSelected(optionElem) }                     
        })
        const hoverCandidate = (hoverFirst) ? children[0] : children[children.length - 1];
        if (!this.hoveredElement) {
            this.markAsHovered(hoverCandidate);
            this.hoveredElement = hoverCandidate;
        } else if (this.hoveredElement !== hoverCandidate) {
            this.unmarkHovered(this.hoveredElement);
            this.markAsHovered(hoverCandidate);
            this.hoveredElement = hoverCandidate;
        }
        return {hovered: this.hoveredElement}
    } 
    
    getIndexFromHover() {
        if (this.hoveredElement) { return Number(this.hoveredElement.dataset.index) }
    } 
}


class SelectionManager {
    constructor({multiple}) {
        this._multiple = multiple;
        this._selection = [];
    }

    get multiple() { return this._multiple }
    set multiple(value) {
        const multiple = (value === 'true' || value === true) ? true : false;
        if (this._multiple !== multiple) { 
            this._multiple = multiple;
            this._selection = []; 
        }       
    }

    reset() { this._selection = [] }

    accept(value) {
        if (this._multiple && !Array.isArray(value)) {
            throw new AttachDropError("accepted value for multiple mode must be an Array");    
        } 
        if (!this._multiple && Array.isArray(value)) {
            throw new AttachDropError("accepted value for single mode must not be an Array");      
        }
        this._selection = (this._multiple) ? value : [value];
    }

    getSelection() { return this._selection }

    getValue() { return (this._multiple) ? this._selection : this._selection[0] }
}


const PLACEHOLDER_INNER = "Поиск...";
const SIZES = {
    deleteBlockSize: 15,
    scrollContainerHeight: 180,
    optionHeight: 30,
    renderQuantity: 7, // для смещенной позиции при которой опция может быть видна частично 
}


export default class AttachDrop extends HTMLElement {
    constructor(optionsArray=[]) {
        super();
        this.attachShadow({mode: "open"});
        this.shadowRoot.append(MAIN_TEMPLATE.content.cloneNode(true));
        this.containerDelete = this.shadowRoot.querySelector(".delete-block");
        this.containerDelete.style.height = `${SIZES.deleteBlockSize}px`; 
        this.containerDelete.style.width = `${SIZES.deleteBlockSize}px`;        
        this.containerMain = this.shadowRoot.querySelector(".drop");
        this.containerScroll = this.shadowRoot.querySelector(".scroll-container");
        this.containerHeight = this.shadowRoot.querySelector(".height-container");
        this.containerContent = this.shadowRoot.querySelector(".content-container");
        this.containerContent.setAttribute('role', 'listbox');
        this.containerContent.setAttribute('tabindex', '0');
        this.inputBlock = this.shadowRoot.querySelector(".input-wrapper");        
        this.input = this.shadowRoot.querySelector("input");       
        
        this.managerData = new DataManager({optionsArray: optionsArray, fastFilterMode: false}); 
        this.managerOption = new OptionManager();
        this.managerMaster = MasterElemLogic();        
        
        // могут быть переопредедены через html атрибуты
        this._scrollerHeight = SIZES.scrollContainerHeight;
        this._optionHeight = SIZES.optionHeight;        
        this._stretch = 1;
        this._placeholder = PLACEHOLDER_INNER;
        this._highlight = false;
        this._highlightStyle = "1px solid rgb(255, 114, 65)";
        this._hiddenInput = false;
        this._validation = false; 
        this._showDel = true;        

        this.managerOption.createTemplate(this._optionHeight);
        this.managerOption.createTemplateByForeignFunc(this._optionHeight);
        this.containerScroll.style.maxHeight = `${this._scrollerHeight}px`;  

        this.renderQuantity = SIZES.renderQuantity;        
        this.lightedElem = null;
        
        this._templateCreator = null;
        
        this.isOpen = false;              
        this.selection = new SelectionManager({multiple: false});
        this.preventScroll = false;                     
    }

    get data() { return this.managerData.data }
    set data(optionsArray) {
        if (this._validation) { InspectFunctions.checkOptions(optionsArray) }
        this.managerData.data = optionsArray;
    }

    get fastFilter() { return this.managerData.fastFilterMode }
    set fastFilter(value) { this.managerData.fastFilterMode = value }   

    get heights() { return [this._scrollerHeight, this._optionHeight] }
    set heights([mainHeight, optionHeight]) {
        const [mHeight, oHeight] = [Number.parseInt(mainHeight), Number.parseInt(optionHeight)];
        if (Number.isInteger(mHeight) && mHeight > 0) { this._scrollerHeight = mHeight }
        else {
            this._scrollerHeight = SIZES.scrollContainerHeight; 
        }
        if (Number.isInteger(oHeight) && oHeight > 0) { this._optionHeight = oHeight }
        else {
            this._optionHeight = SIZES.optionHeight;
        }     
        const quantity = Math.round(this._scrollerHeight / this._optionHeight); 
        this.renderQuantity = quantity + 1;  // для смещенной позиции при которой опция может быть видна частично    
        this._scrollerHeight = quantity * this._optionHeight;        
        this.managerOption.createTemplate(this._optionHeight); 
        this.managerOption.createTemplateByForeignFunc(this._optionHeight);       
        this.containerScroll.style.maxHeight = `${this._scrollerHeight}px`;         
    }

    get stretch() { return this._stretch }  
    set stretch(value) {
        let stretch = Number(value);
        this._stretch = (stretch === 0 || Number.isNaN(stretch)) ? 1 : stretch;          
    }

    get placeholder() { return this._placeholder }
    set placeholder(value) {      
        this._placeholder = (!value) ? PLACEHOLDER_INNER : value;        
        this.input.placeholder = this._placeholder;      
    }

    get highlight() { return this._highlight }
    set highlight(value) {
        this._highlight = (!value || value === "false") ? false : true;    
    }

    get highlightOutline() { return this._highlightStyle }
    set highlightOutline(value) {
        const style = (value) ? value : this._highlightStyle;
        this._highlightStyle = style;    
    }

    get multiple() { return this.selection.multiple }
    set multiple(value) { this.selection.multiple = value }

    get hiddenInput() { return this._hiddenInput }
    set hiddenInput(value) {
        this._hiddenInput = (value === "true" || value === true) ? true : false;      
    }

    get validation() { return this._validation }
    set validation(value) {
        this._validation = (value === "true" || value === true) ? true : false;       
    }

    get templateCreator() { return this._templateCreator }
    set templateCreator(func) {
        // функция, которая возвращает DocumentFragment
        if (typeof func !== 'function') {
            throw new AttachDropError("templateCreator must be a function")
        }
        this._templateCreator = func;
    }

    get showDel() { return this._showDel }
    set showDel(value) {
        this._showDel = (value === "false") ? false : true;        
    }

    _acceptHtmlAttributes() {
        // применение html атрибутов
        this.fastFilter = this.dataset.fastFilter;
        this.heights = [this.dataset.height, this.dataset.optionHeight];
        this.stretch = this.dataset.stretch;
        this.placeholder = this.dataset.placeholder;   
        this.highlight = this.dataset.highlight;
        this.highlightOutline = this.dataset.highlightOutline; 
        this.multiple = this.dataset.multiple;
        this.hiddenInput = this.dataset.hiddenInput;
        this.showDel = this.dataset.showDel;
        
        this.inputBlock.hidden = this.hiddenInput;
    }
        
    _preventPageScrolling(wheelEvent) {
        // скроллинг внутри компонента запрещает скроллинг страницы        
        const scrollTop = this.containerScroll.scrollTop;               
        const scrollHeight = this.containerScroll.scrollHeight;
        const height = this.containerScroll.clientHeight;
        const delta = wheelEvent.deltaY;           
        if (delta < 0 && scrollTop === 0) { wheelEvent.preventDefault() }       
        if (delta > 0 && scrollTop + height >= scrollHeight) { wheelEvent.preventDefault() }
    } 
    
    _makeVisible(startIndex) {
        const optionHeight = this._optionHeight;  
        if (this.showDel) { this.containerDelete.style.display = "flex" }                
        this.containerMain.hidden = false;
        this.containerScroll.scrollTop = startIndex * optionHeight;          
        this.input.focus();                
        this.addEventListener("wheel", this._preventPageScrolling);  
    }

    _makeHidden() {        
        if (this.lightedElem) {
            this.lightedElem.style.outline = "none";
            this.lightedElem = null; 
        }            
        this.containerDelete.style.display = "none";
        this.containerMain.hidden = true;       
        this.input.value = null; 
        this.isOpen = false;        
        this.selection.reset();      
        this.removeEventListener("wheel", this._preventPageScrolling);        
    }   

    _fillContainers(options, startIndex, totalLength) {               
        const optionHeight = this._optionHeight;       
        this.containerContent.innerHTML = '';
        this.containerContent.append(options);             
        this.containerContent.style.top = `${startIndex * optionHeight}px`;        
        if (totalLength !== undefined) {
            this.containerHeight.style.height = `${optionHeight * ((totalLength === 0) ? 1 : totalLength)}px`; 
        }    
    }

    open(masterElem, value) {              
        if (!masterElem) { return }
        if (this.highlight) {
            this.lightedElem = masterElem;
            this.lightedElem.style.outline = this._highlightStyle;
        } 
        this.isOpen = true;        
        this.selection.accept(value);

        this.managerMaster.updateState(masterElem);
        this.managerMaster.alignmentVertical(this.containerMain, this._scrollerHeight);
        this.managerMaster.alignmentHorizontal(this.containerMain, this._stretch);
        this.managerMaster.defineWidth(this.containerMain, this._stretch);
        this.managerMaster.positionToLeftUp(this.containerDelete, SIZES.deleteBlockSize);                
        const [dataForRender, startIndex, totalLength] = this.managerData.getDataForOpen({outerValue: this.selection.getSelection(), quantity: this.renderQuantity});              
        const options = this.managerOption.createOptions({
            dataForRender: dataForRender,
            selectedValue: this.selection.getSelection(),
            templateCreator: this.templateCreator
        }); 
        this._fillContainers(options, startIndex, totalLength);            
        this._makeVisible(startIndex);                                 
    }

    close() {
        this._makeHidden();    
    }    

    eventFilter() {        
        const inputText = this.input.value;           
        const [dataForRender, totalLength] = this.managerData.getDataForFilter({inputText: inputText, quantity: this.renderQuantity});  
        const options = this.managerOption.createOptions({
            dataForRender: dataForRender,
            selectedValue: this.selection.getSelection(),
            templateCreator: this.templateCreator
        });
        this._fillContainers(options, 0, totalLength);
        this.containerScroll.scrollTop = 0;           
    }

    eventScroll(periodMs) {
        const self = this; 
        let [awaiting, stop] = [false, true];                
        function throttle() {                                              
            if (self.preventScroll) { self.preventScroll = false; return }                                                                            
            if (awaiting) { stop = false; return }
            
            const [scrollPosition, optionHeight] = [self.containerScroll.scrollTop, self._optionHeight];
            const startInd = Math.round(scrollPosition / optionHeight);
            const dataForRender = self.managerData.getDataForScroll({startIndex: startInd, quantity: self.renderQuantity});                      
            const options = self.managerOption.createOptions({
                dataForRender: dataForRender,
                selectedValue: self.selection.getSelection(),
                templateCreator: self.templateCreator
            });
            self._fillContainers(options, startInd);
            awaiting = true;
            setTimeout(function() {
                awaiting = false;
                if (!stop) {
                    throttle()
                    stop = true;
                }
            }, periodMs)
        }
        return throttle;
    }
    
    eventScrollRequestAnimation() {
        const self = this;
        let ticking = false;    
        function throttle() {            
            if (self.preventScroll) { self.preventScroll = false; return }
    
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const [scrollPosition, optionHeight] = [self.containerScroll.scrollTop, self._optionHeight];                   
                    const startInd = Math.round(scrollPosition / optionHeight);
                    const dataForRender = self.managerData.getDataForScroll({startIndex: startInd, quantity: self.renderQuantity});
                    const options = self.managerOption.createOptions({
                        dataForRender: dataForRender,
                        selectedValue: self.selection.getSelection(),
                        templateCreator: self.templateCreator
                    });
                    self._fillContainers(options, startInd);    
                    ticking = false;
                });    
                ticking = true;
            }            
        }    
        return throttle;
    }
    
    _scrollShift(onTop, wholeShift) {
        // сдвигаем положение прокрутки, чтобы частично видимая опция стала видна полностью
        this.preventScroll = true;
        const optionHeight = this._optionHeight;        
        if (!wholeShift) {
            let qnt = null;                             
            if (onTop) { qnt = Math.floor(this.containerScroll.scrollTop / optionHeight) }
            else { qnt = Math.ceil(this.containerScroll.scrollTop / optionHeight) }
            this.containerScroll.scrollTop = qnt * optionHeight;  
        } else {
            let [qnt, qntRound] = [this.containerScroll.scrollTop / optionHeight, null];                               
            if (onTop) {
                qntRound = Math.floor(qnt);
                if (qntRound === qnt) { qntRound -= 1 }
            } else { 
                qntRound = Math.ceil(qnt);
                if (qntRound === qnt) { qntRound += 1 }                    
            }                                                             
            this.containerScroll.scrollTop = qntRound * optionHeight;      
        }       
    }

    eventMouseHover(event) { 
        const optionElem = event.target;          
        const {success, hovered} = this.managerOption.applyHoverToOption(optionElem);
        if (!success) { return }
        const {hidden, onTop} = this.managerOption.optionIsPartialyHidden(hovered, this.containerScroll);
        if (hidden) { this._scrollShift(onTop, false) }                  
    }   
      
    eventSelect() {
        const hoverIndex = this.managerOption.getIndexFromHover();
        const {success, value, option} = this.managerData.getValueByIndex(hoverIndex);        
        if (!success) { return }              
        this.dispatchEvent(
            new CustomEvent(
                "attachSelect",
                {
                    bubbles: true,
                    detail: {
                        element: this.managerMaster.getMasterElement(),
                        multiple: this.selection.multiple,
                        value: value,
                        option: option,
                    }
                }
            )
        ); 
        this._makeHidden();
    }

    _keyboardHover(down) {              
        const {option, startIndex, endIndex} = this.managerOption.keyBoardSwitch(this.containerContent, down);      
        const {hidden, onTop} = this.managerOption.optionIsPartialyHidden(option, this.containerScroll);
        if (hidden) { this._scrollShift(onTop, true) }         
        if (startIndex === undefined || startIndex === null) { return } 

        const params = {startIndex: startIndex, endIndex: endIndex, selectedValue: this.selection.getSelection(), down: down}
        const {circle, forRender, hoverFirst, newStartInd, scrollShift} = this.managerData.getDataForKeyboard(params);        
        if (circle) { return }

        const optionHeight = this._optionHeight;
        this.containerContent.style.top = `${newStartInd * optionHeight}px`; 
        this.preventScroll = true;
        this.containerScroll.scrollTop += optionHeight * scrollShift;

        const {hovered} = this.managerOption.rewriteOptions({
            container: this.containerContent,
            forRender, hoverFirst,
            selectedValue: this.selection.getSelection(),
            templateCreator: this.templateCreator,
        }) 
        if (hovered) {            
            const {hidden, onTop} = this.managerOption.optionIsPartialyHidden(hovered, this.containerScroll);            
            if (hidden) { this._scrollShift(onTop, true) }      
        }               
    }

    eventKeyboard(event) {
        const key = event.key;
        if (key === "Enter") {
            this.eventSelect();
            this._makeHidden();
            event.stopImmediatePropagation();
        } else if (key === "ArrowDown") {
            event.preventDefault();            
            this._keyboardHover(true);
        } else if (key === "ArrowUp") {
            event.preventDefault();             
            this._keyboardHover(false);
        } else if (key === "ArrowLeft" || key === "ArrowRight") {
            event.preventDefault();
            this.managerOption.applyHoverToOption(null);    
        }
    } 
    
    eventReset() {
        this.dispatchEvent(
            new CustomEvent(
                "attachReset",
                {
                    bubbles: true,
                    detail: {
                        element: this.managerMaster.getMasterElement(),
                        multiple: this.selection.multiple,
                        value: this.selection.getValue()
                    }
                }
            )
        ); 
        this._makeHidden();    
    } 
    
    eventResize() {
        if (!this.isOpen) { return }        
        const element = this.managerMaster.getMasterElement();
        const value = this.selection.getValue();
        this.close();        
        this.open(element, value);
    }

    registerListeners() {
        this.handlerFilter = this.eventFilter.bind(this);
        this.handlerScroll = this.eventScrollRequestAnimation();
        this.handlerMouseHover = this.eventMouseHover.bind(this);
        this.handlerKeyBoard = this.eventKeyboard.bind(this);
        this.handlerSelect = this.eventSelect.bind(this);
        this.handlerReset = this.eventReset.bind(this);
        this.handlerResize = this.eventResize.bind(this);
    }

    connectedCallback() {
        this._acceptHtmlAttributes();
        this.registerListeners();               
        this.input.addEventListener("input", this.handlerFilter); 
        this.containerScroll.addEventListener("scroll", this.handlerScroll);
        this.containerContent.addEventListener("mouseover", this.handlerMouseHover);  
        this.containerContent.addEventListener("click", this.handlerSelect);       
        this.addEventListener("keydown", this.handlerKeyBoard);
        this.containerDelete.addEventListener("click", this.handlerReset); 
        window.addEventListener("resize", this.handlerResize);                   
    }

    disconnectedCallback() {
        this.input.removeEventListener("input", this.handlerFilter); 
        this.containerScroll.removeEventListener("scroll", this.handlerScroll);
        this.containerContent.removeEventListener("mouseover", this.handlerMouseHover);
        this.containerContent.removeEventListener("click", this.handlerSelect);         
        this.removeEventListener("keydown", this.handlerKeyBoard); 
        this.containerDelete.removeEventListener("click", this.handlerReset);  
        window.removeEventListener("resize", this.handlerResize);       
    }

    externalFiltration(text) {        
        // может использоваться для присоединения к внешнему input-элементу и фильтрации по вводу                     
        const [dataForRender, totalLength] = this.managerData.getDataForFilter({inputText: text, quantity: this.renderQuantity});         
        const options = this.managerOption.createOptions({
            dataForRender: dataForRender,
            selectedValue: this.selection.getSelection(),
            templateCreator: this.templateCreator
        });
        this._fillContainers(options, 0, totalLength);
        this.containerScroll.scrollTop = 0;           
    }
}

customElements.define("attach-drop", AttachDrop);

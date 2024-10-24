/* eslint-disable no-global-assign */
/* eslint-disable no-self-assign */
/* eslint-disable no-prototype-builtins */
/* eslint-disable no-extra-boolean-cast */
/* eslint-disable no-unreachable */
/* eslint-disable @typescript-eslint/no-array-constructor */
/* eslint-disable no-empty */
/* eslint-disable no-extra-semi */
/* eslint-disable no-fallthrough */
/* eslint-disable no-undef */
/* eslint-disable no-redeclare */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-var */
////////////////////////////////////////////////////////////////////////////////////////////////////
//
//	Générateur de trames de configuration pour les produits nke Watteco LoRaWAN
//
////////////////////////////////////////////////////////////////////////////////////////////////////


// TOOLS
//--------------------------------------------------------------------------------------------------
// This code empowers all input tags having a placeholder and data-slots attribute

function SetInputMaskMngt() {
	//document.addEventListener('DOMContentLoaded', () => {
		for (const el of document.querySelectorAll("[placeholder][data-slots]")) {
			const pattern = el.getAttribute("placeholder"),
				slots = new Set(el.dataset.slots || "_"),
				prev = (j => Array.from(pattern, (c,i) => slots.has(c)? j=i+1: j))(0),
				first = [...pattern].findIndex(c => slots.has(c)),
				accept = new RegExp(el.dataset.accept || "\\d", "g"),
				clean = input => {
					input = input.match(accept) || [];
					return Array.from(pattern, c =>
						input[0] === c || slots.has(c) ? input.shift() || c : c
					);
				},
				format = () => {
					const [i, j] = [el.selectionStart, el.selectionEnd].map(i => {
						i = clean(el.value.slice(0, i)).findIndex(c => slots.has(c));
						return i<0? prev[prev.length-1]: back? prev[i-1] || first: i;
					});
					el.value = clean(el.value).join``;
					el.setSelectionRange(i, j);
					back = false;
				};
			let back = false;
			el.addEventListener("keydown", (e) => back = e.key === "Backspace");
			el.addEventListener("input", format);
			el.addEventListener("focus", format);
			el.addEventListener("blur", () => el.value === pattern && (el.value=""));
		}
	//});
}
//--------------------------------------------------------------------------------------------------
//	PARTIE 1 : Définition des différentes variables pour la suite du programme
//--------------------------------------------------------------------------------------------------


//Fonction récupérant la valeur du cookie de langue
function getLang() {	
	var langCookie = "lang=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(langCookie) == 0) {
			var langCookieValue = c.substring(langCookie.length,c.length);
			return parseInt(langCookieValue);
		}
	}
	return 0;
}


//Variable contenant la langue actuelle
var lang = getLang();

// Une fonction qui permet de fermer le logiciel LoraUpdater.exe à la fermeture de la page 
// var isSwitchingLang = false;

// sessionStorage.setItem('reloaded', 'yes');

// window.addEventListener('beforeunload', (event) => {
// 	if (sessionStorage.getItem('reloaded') != null) {
// 		console.log('page was reloaded');
// 	} else {
// 		console.log('page was not reloaded');
// 		if (gLocalConfiguration && !isSwitchingLang) {
// 			navigator.sendBeacon("https://localhost:56700/System.txt","Action=Quit");
// 			console.log("Fermeture du logiciel");
// 		}
// 	}
// });
var isSwitchingLang = false;
window.addEventListener('beforeunload', (event) => {
    if (gLocalConfiguration && !isSwitchingLang) {
		navigator.sendBeacon("https://localhost:56700/System.txt","Action=Quit");
		console.log("Fermeture du logiciel");
    }

});

//Définition des constantes de langue
var langData = {
	mainTitle: ["LoRaWAN frame encoder","Encodeur de trames LoRaWAN"],
	toolDesc: ["This tool allows to generate frames for LoRaWAN sensors in a simplified way. It may be possible that your sensor is not in the list or that some options are not yet available.","Cet outil permet de générer des trames pour les capteurs LoRaWAN de façon simplifiée. Il est possible que votre capteur ne soit pas présent dans la liste ou que certaines options ne soient pas encore disponibles."],
	frameEncoder: ["Frame encoder","Encodeur de trames"],
	firstMsg: ["First choose the sensor model, then select a command and edit the available parameters.","Choisissez tout d'abord le modèle de capteur, puis sélectionnez une commande et éditez les paramètres disponibles."],
	chooseProductMsg: ["Choose a product :","Choisissez un produit :"],
	chooseSubProductMsg: [" Target device :"," Matériel cible :"],
	chooseFunctionMsg: ["Choose a function :","Choisissez une fonction :"],
	simple: ["Simple","Simple"],
	advanced: ["Advanced","Avancé"],
	editParameterMsg: ["Modify the following parameters to generate the desired frame :","Modifiez les paramètres suivants afin de générer la trame souhaitée :"],
	parameter: ["Parameter","Paramètre"],
	value: ["Value","Valeur"],
	TICHeaderSelect: ["Field to report ?", "Champ à reporter"],
	TypeString: ["Characters string", "Chaine de caractères"],
	valueCom:["A report will be sent on crossing this value","Un rapport sera envoyé sur franchissement de cette valeur. En mode Threshold la valeur de franchissement prise en compte est Valeur +- Hystérésis"],
	comment: ["Comment","Commentaire"],
	endpoint: ["EndPoint","EndPoint"],
	report: ["Report type","Type de rapport"],
	to: ["to","à"],
	or: ["OR\n","OU\n"],
	seconds: ["seconds","secondes"],
	minutes: ["minutes","minutes"],
	secondsOrMinutes: ["seconds or minutes","secondes ou minutes"],
	size:["Size","Taille"],
	name: ["Name","Nom"],
	read: ["Read","Lire"],
	time: ["Time","Temps"],
	source: ["Source","Source"],
	sourceCom:["",""],
	mode: ["Mode","Mode"],
	modeCom:["","Threshold: slot configuré pour un seuil | Delta: slot configuré pour une variation"],
	alarm: ["Alarm","Alarme"],
	alarmCom:["On crossing, the report will be sent in alarm mode","Sur franchissement, le rapport sera envoyé en mode alarme (cmdID = 0x8A)"],
	onExceed: ["On exceed","Franchissement supérieur"],
	onExceedCom:["",""],
	onFall:["On fall","Franchissement inférieur"],
	onFallCom:["",""],
	onCheck:["You need to choose on exceed or on fall.","Vous devez choisir par franchissement supérieur ou inérieur."],
	occurences:["Occurences","Occurences"],
	occurencesCom:["Number of occurence to reach before sending a report","Nombres d'occurences à atteindre pour lequel un rapport sera envoyé"],
	gap:["Gap","Hystérésis"],
	gapCom:["",""],
	add:["add","ajouter"],
	del:["delete","supprimer"],
	causeRequest: ["Cause Request","Demande de Cause"],
	causeRequestCom:["No cause: no cause is added to the report | Short cause: a short cause is added to the report | Long cause: a long cause is added to the report","Aucune: aucune cause n'est ajouté au rapport | Courte: une cause courte est ajoutée au rapport | Longue: une cause longue est ajoutée au rapport"],
	noCause:["No cause","Aucune"],
	shortCause:["Short cause","Courte"],
	longCause:["Long cause","Longue"],
	secured: ["Secured","Sécurisé"],
	securedCom:["If checked, the report will be sent with an acknowledgment request. Otherwise it will be sent without an acknowledgment request. It takes priority over the LoRaWAN / MessageType cluster.","Si coché, le rapport sera envoyé avec demande d'acquittement. Sinon il sera envoyé sans demande d'acquittement. C'est prioritaire par rapport au cluster LoRaWAN/MessageType."],
	addSlot: ["Add slot","Ajouter un slot"],
	addSlotCom:["Add a new slot to configure","Ajouter un nouveau seuil ou variation à configurer"],
	securedIfAlarm:["Secured if alarm","Sécurisé en cas d'alarme"],
	securedIfAlarmCom:["If the report is an alarm then it will be sent with an acknowledgment request","Si le rapport est une alarme alors il sera envoyé avec demande d'acquittement"],
	slotNumber:["Slot number","Numéro du slot"],
	slotNumberCom:["",""],
	outputSelectMsg: ["Select the desired output format :","Sélectionnez le format de sortie souhaité :"],
	outputFormatTitle: ["Output format","Format de sortie"],
	outputFormatDesc: ["Description","Description"],
	generateOutput: ["Generate output","Générer la sortie"],
	frame: ["Frame","Trame"],
	directSend: ["Send to end-device","Envoyer au périphérique"],
	text: ["Text","Texte"],
	frameDesc: ["This output format provides the configuration frame directly. This one may be sent directly to the sensor later via the dedicated platform.","Ce type de sortie permet d'obtenir directement la trame de configuration. Celle-ci pourra être envoyée directement au capteur par la suite via la plateforme dédiée."],
	jsonDesc: ["Advanced users - This type of output returns entered informations in a JSON format. This data can be processed by the Python program whose source code is available for download via the link at the bottom of the page.","Utilisateurs avancés - Ce type de sortie restitue les informations entrées sous un format JSON. Ces données peuvent être traitées par le programme en Python dont le code source est disponible en téléchargement via le lien présent en bas de la page."],
	directSendDesc: ["This option allows you to send the entered configuration directly to the selected end-device. It is necessary to check manually afterwards that the information is correctly taken into account by the end-device.","Cette option permet d'envoyer directement la configuration saisie au périphérique choisi. Il est nécessaire de vérifier manuellement par la suite la correcte prise en compte des informations par le capteur."],
	txtDesc: ["Create a txt file wich contain the trame to be send to fota","Creer un fichier txt à envoyer à fota"], 
	chooseOutput: ["Choose this format","Choisir ce format"],
	sendFrameOutput: ["Send the frame","Envoyer la trame"],
	chooseOption: ["Choose this option","Choisir cette option"],
	addOutput: ["Add this frame","Ajouter cette trame"],
	resetOutput: ["Reset the output","Réinitialiser la sortie"],
	resetConfFrame: ["Click to add the reset conf frame","Cliquer pour ajouter la trame de réinitalisation de la configuration"],
	finalFrameMsg: ["The frame to send (port <span style='color: #FF9526;'>125</span>) is available below :","La trame à envoyer au capteur (port <span style='color: #FF9526;'>125</span>) est disponible ci-dessous :"],
	finalJsonMsg: ["Entered data is available below in a JSON format :","Les données saisies sont disponibles ci-dessous dans un format JSON :"],
	finalTxtMesg: ["Txt file is disponible below","Le fichier text est disponible ci-dessous"],
	finalTxtMessDownload:["Save the configuration","Enregistrer votre configuration"],
	finalConfigLoadFile:["Load your configuration: ","Charger votre configuration: "],
	finalTxtMessLabelInput:["Choose a name for your configuration file: ","Choisissez un nom pour votre fichier de configuration: "],
	finalConfMsg: ["Your configuration is available below:","Votre configuration est disponible ci-dessous:"],
	finalSelectMsgCom: ["Fill in your COM port.","Renseignez votre port COM."],
	finalSelectMsgSelect: ["Select your DeviceList.","Sélectionner votre DeviceList."],
	customFile: ["Custom your device list","Modifier votre liste d'appareils"],
	listCustomDevice: ["Devices in list","Appareils dans la liste"],
	addDevice: ["Add this device","Ajouter cet appareil"],
	createFile: ["Create file","Créer ce fichier"],
	finalConfButton:["⑧ Enter the configuration mode to send your configuration n°","⑧ Entrer en mode configuration pour envoyer votre configuration n°"],
	errorLoadConf: ["The configuration you chose doesn't match with the selected device.","Vous avez sélectionné une configuration qui n'est pas valable pour ce capteur"],
	errorMsg: ["An error has occurred ! Please try again.","Une erreur est survenue ! Veuillez réessayer."],
	errorTrame:["Your frame contain too many bytes","Ta trame contient trop d'octets"],
	errorFota:["Don't forget to open your local configuration tool.","N'oubliez pas d'allumer votre outil de configuration local."],
	downloadCodec: ["Codecs used can be downloaded by following this link : ","Le programme utilisé peut être téléchargé via ce lien : "],
	hideAndShowButton: ["Hide/Show local configuration","Afficher/masquer la configuration locale"],
	congratulation:["Now, Power OFF/ON your device to update the configuration.","Maintenant, vous pouvez allumer/éteindre votre appareil pour mise à jour configuration."],
	click:["Configuration","Configuration"],
	FichierKeyManquant:["Select Key Files","Sélectionner le fichier de clés"],
	getDeviceList:["Active device:","Appareil actif:"],
	warningSlot:["You always need at least one slot.","Vous avez besoin d'avoir un slot minimum."]
};


//Variables enregistrant les données des choix de l'utilisateur
var currentProduct = ""; //Produit choisi
var currentSubProduct = ""; //Produit associé choisi
var currentSelectedMode = 0; // Mode sélectionné 
var currentProductData = null; //Données du produit choisi
var currentCluster = ""; //Cluster concerné
var currentClusterData = null; //Données du cluster concerné
var currentEmbeddedName = "";
var currentDefaultFrame = [];
var currentDefaultCfgAddress = "";
var currentDefaultCfgCRCAddress = "";
var currentDefaultAddresses = ["@10a00\n","@10bfe\n"];
var currentMultiplier = 1;
var currentAttribute = ""; //Fonction choisie
var currentReportType = 0; //Type de rapport actuel
var currentCommand = ""; //Commande actuellement choisie
var currentCommandParameters = {}; //Paramètres de la commande actuelle
var currentSubparameter = null; //Sous-paramètre actuellement choisis
var currentCustomData = null;
var EndPointDependantParametersList = []; // Liste des paramètres dépendant du EndPoint
var parameterIndex = 0; //Création d'une variable contenant le numéro d'index du paramètre actuel initialisée à 0
		


// variable contenant la trame pour OTA
var gDataReset = "06 11 50 00 50 02 03";
var gDataStart ="@10a00\n";
var gDataConcatenation = "";
var gDataConcatenateLength = Number(gDataConcatenation.length);
var gDeviceList = '';
var gDeviceListName = '';

// 3 Lines for FOTA LEC 
var gDeviceListCustom = [];
var gDeviceTempListCustom = [];
var gDeviceInputCorrect = {'addDevEUI' : false, 'addNwkSKeyABP' : false, 'addAppSKeyABP' : false, 'addAppKey' : false};

var gFileLoaded = false;


// Variable contenant la config de base des batchs
var configBatch = [];

//--------------------------------------------------------------------------------------------------
//	PARTIE 2 : Définition de différentes fonctions utiles pour la suite
//--------------------------------------------------------------------------------------------------

// Fonction qui met au format YYMMDD la date du jour

function formatDate(){
	var ladate = new Date();
	return "" + (ladate.getFullYear() - 2000) + (ladate.getMonth()+1) + ladate.getDate();
}


// Genere un nombre aléatoire héxadécimal sur n digit
function rndHexValue(digit){
  var letters = "0123456789ABCDEF"; 
  var number = ''; 
  for (var i = 0; i < digit; i++)
    {
		number+= letters[(Math.floor(Math.random() * 16))]; 
    }
    return number
}
function replaceAt(str, index, replacement) {
    return str.substr(0, index) + replacement + str.substr(index + replacement.length);
}
// Foncion permettant de rajouter un 0 devant un chiffre ( twoDigit(1) --> 01 etc..)
function twoDigit(n) {
  return (n.length === 1 ? '0' : '') + n
}

// Fonction permettant l'ajout d'espace tous les 2 caractères pour les trames

function addSpace (list){
  var newList = []
  var regex = /,/gi;
  for(var i=0; i<list.length; i++){
    if(i%2===0 && i>0){
      newList.push(" ");
    }
    newList.push(list[i])
  }
  return newList.toString().replace(regex, '')
}


function formatBitmap(size,bit,x){
	var obj = {};
	for(var i=size-1;i!=0;i--){
		obj["b"+(i)] = 0
	}
	obj["b"+bit] = x;
	return obj
}

// variable contenant une valeur aléatoire à ajouter à la trame
var rndHex = rndHexValue(4);
var rndHexToDec = 0; // From FOTA LEC set to 0
//var rndHexToDec = parseInt("" + rndHex.slice(2,4) +rndHex.slice(0,2),16).toString(10);
var gRandValueConfig = currentDefaultAddresses[1] + addSpace(rndHex) + "\nq";

function getRootUrl() {
	return window.location.origin 
		? window.location.origin + '/'
		: window.location.protocol + '/' + window.location.host + '/';
	

}

function getBaseUrl() {
	var re = new RegExp(/^.*\//);
	return re.exec(window.location.href);
}

//Fonction permettant la lecture des fichiers .json
var getJSON = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
	xhr.responseType = "text";
	xhr.onload = function() {
		var status = xhr.status;
		if (status === 200) {
			callback(null, JSON.parse(xhr.response));
		} else {
			callback(status, xhr.response);
		}
	};
    xhr.send();
};

//Fonction permettant la lecture des fichiers .json
var getJSON2 = function(url, callback, extraParameters = null) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
	xhr.extraParameters = extraParameters;
	xhr.responseType = "text";
	xhr.onload = function() {
		var status = xhr.status;
		if (status === 200) {
			callback(null, JSON.parse(xhr.response),xhr.extraParameters);
		} else {
			callback(status, xhr.response,xhr.extraParameters);
		}
	};
    xhr.send();
};



function postHTML(){
	if(document.getElementById("postButton").checked){

		document.getElementById("fieldset").setAttribute("disabled","true")
		postCom();
		
		let start = "DevEUI;ABP_DevAddr;ABP_NwkSKey;ABP_AppSKey;CodeFamille;Version;OTA_AppKey;OTA_AppEUI;Unconfirmed;CodeFamillePF;Synchro;Adr\n"

		var date = formatDate();
		var lrndHex = "" + rndHex.slice(2,4) +rndHex.slice(0,2);
		
		var xhr = new XMLHttpRequest();
		
		xhr.open("POST", path + 'C0.0.0.0_' + currentEmbeddedName + '.' + parseInt(lrndHex,16).toString(10) +'.' + date +'.txt', true);

		xhr.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
		xhr.onreadystatechange = function() { //Appelle une fonction au changement d'état.
				if (this.readyState === XMLHttpRequest.DONE &&  ((this.status === 201) || (this.status === 200))) {
					document.getElementById("postButtonResultId").innerHTML = '<b>' + langData.congratulation[lang] + '</b>' ;

					var xhr = new XMLHttpRequest();
					
					xhr.open("POST", path + "ListeProduits_" + Math.floor(Math.random() * 10000) + ".txt" , true);
					//fileFormat[0] === "txt" ? xhr.setRequestHeader("Content-Type", "text/plain;charset=UTF-8") : xhr.setRequestHeader("Content-Type", "Application/octet-stream") ;
					xhr.setRequestHeader("Content-Type", "text/plain");
					xhr.setRequestHeader("Accept","*/*");
					xhr.onreadystatechange = function() { //Appelle une fonction au changement d'état.
							if (this.readyState === XMLHttpRequest.DONE &&  (this.status === 200)) {
								console.log('Your list of product has been sent');
							} else if(this.readyState === XMLHttpRequest.DONE){
								console.log('An error occured while transferring your list of product');
							}
						}
						
					xhr.send(createdFileFormatted())
					

					
				}  else if(this.status === 0){
					alert(langData.errorFota[lang]);
				}else if(this.readyState === XMLHttpRequest.DONE){
					document.getElementById("postButtonResultId").innerHTML = langData.FichierKeyManquant[lang];
					setTimeout(function(){ document.getElementById("postButtonResultId").innerHTML = ''; }, 3000);
				}
			}
		
		xhr.send(currentDefaultAddresses[0]  + (gLocalConfiguration   ? gDataReset +"\n" : "") +gDataConcatenation +gRandValueConfig);
	}else{
		document.getElementById("postButtonResultId").innerHTML = '';

		document.getElementById("fieldset").removeAttribute("disabled")

		var xhr = new XMLHttpRequest();
					
		xhr.open("POST", path + gDeviceListName, true);
		xhr.setRequestHeader("Content-Type", "text/plain");
		xhr.setRequestHeader("Accept","*/*");
		xhr.onreadystatechange = function() { //Appelle une fonction au changement d'état.
				if (this.readyState === XMLHttpRequest.DONE &&  (this.status === 200)) {
					console.log('Your empty list of product has been sent');
				} else if(this.readyState === XMLHttpRequest.DONE){
					console.log('An error occured while transferring your empty list of product');
				}
			}
	xhr.send("DevEUI;ABP_DevAddr;ABP_NwkSKey;ABP_AppSKey;CodeFamille;Version;OTA_AppKey;OTA_AppEUI;Unconfirmed;CodeFamillePF;Synchro;Adr;SN;NumBL;NumCde;DevEUI2");
		
	}
	
}

function postCom(){
	
	var xhr = new XMLHttpRequest();
	//xhr.open("POST", 'https://localhost:56700/System.txt', true);
	xhr.open("POST", 'http://localhost:56700/System.txt', true);
	//xhr.setRequestHeader('Access-Control-Allow-Headers', '*');
	//xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
	//Envoie les informations du header adaptées avec la requête
	xhr.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
	xhr.onreadystatechange = function() { //Appelle une fonction au changement d'état.
		
		if (this.readyState === XMLHttpRequest.DONE && ((this.status === 201) || (this.status === 200))) {
		// Requête finie, traitement ici.
			console.log("Com port sent.");
		
		} else{
			if (this.status === 0){
			console.log(langData.errorFota[lang]);
			}else{
			console.log(langData.errorMsg[lang]);
			}
		} 
	}
	
	xhr.send("DonglePort="+document.getElementById("selectCom").value);
}
//Fonction permettant de vider le contenu d'un élément HTML précis
function clearElement(element) {
	var node = document.getElementById(element);
	if(node != null) {
		while (node.firstChild) {
			node.removeChild(node.firstChild);
		}
	}
}


//Réinitialisation des données des choix de l'utilisateur
function resetData(element) {
	switch(element) {
		case "product":
			currentProduct = "";
			currentReportType = 0;
			currentProductData = {};
			currentCustomData = null;
		case "subProduct":
			currentSubProduct = "";
			currentCluster = "";
			currentClusterData = {};
			EndPointDependantParametersList = [];
			currentCategory = "";
			clearElement("productConfigOption");
			clearElement("configContainer");
			clearElement("generateButtonContainer");
			clearElement("jsonOutput");
			clearElement("frameOutput");
			clearElement("txtOutput");
			
		break;
		case "category":
			currentCluster = "";
			currentClusterData = {};
			EndPointDependantParametersList = [];
			currentCategory = "";
			currentReportType = 0;
			clearElement("configContainer");
			clearElement("generateButtonContainer");
			clearElement("jsonOutput");
			clearElement("frameOutput");
			clearElement("txtOutput");
		break;
	}
}


//Changement de la langue utilisée
function switchLang() {
	var selectedLang = parseInt(document.getElementById('langSelect').value);
	
	if(gLocalConfiguration) isSwitchingLang = true;
	var date = new Date();
	date.setTime(date.getTime()+2500000000);
	var expire = "; expire=" + date.toGMTString();
	
	document.cookie = "lang=" + selectedLang + expire + "; path=/";
	document.location.reload(true);
}

//Obtenir la variable de local setu
function getLocalConfiguration() {
	getJSON("configuration.json?v=" + (new Date()).getTime(),
		function(err, LocalConfigurations) {
			if (err !== null) {
				alert('Une erreur est survenue : ' + err);
			} else {
				gLocalConfiguration = LocalConfigurations.OutilLocalDeConfigurationOTA;
				refreshTiming = LocalConfigurations.refreshTimingOnGet;
				path = LocalConfigurations.pathPost;
			}
		}
	);
}

	


// Variable pour dire si nous sommes en local ou non
var gLocalConfiguration = false;
var refreshTiming = 100000;
var path = "";


//Obtenir la liste des produits disponibles
function getAllAvailableProducts() {
	getLocalConfiguration();
	
  // Use 2nd line from FOTA LEC
	//getJSON(getRootUrl() + "/Lora/WattecoSensors/AvailableProductsList.json?v=" + (new Date()).getTime(),
  getJSON("/Lora/WattecoSensors/AvailableProductsList.json?v=" + (new Date()).getTime(),
		function(err, availableProducts) {
			if (err !== null) {
				console.log('Une erreur est survenue : ' + err);
			} else {
				var selectProduct = document.getElementById("productSelect");
				availableProducts.products.forEach(function(product){
					displayed = 1;
					if(typeof(product["apps"]) !== 'undefined') {
            // loraEncoderType defined in calling index.html ("LoraEncoder" or "LoraEncoderConfiguration")
						displayed = product.apps.includes(loraEncoderType);
					}
					if (displayed) {
						var opt = document.createElement('option');
						opt.appendChild(document.createTextNode((Array.isArray(product.name) ? product.name[lang] : product.name)));
						opt.value = product.file;
						selectProduct.appendChild(opt);
					}	
				});
			}
		}
	);
}

function getEmbeddedProductName() {
	getJSON(getRootUrl() + "/lora/WattecoSensors/products/"+ currentProduct + ".json?v=" + (new Date()).getTime(),
		function(err, currentProduct) {
			if (err !== null) {
				console.log('Une erreur est survenue : ' + err);
			} else {
				currentEmbeddedName = currentProduct.embeddedProductName;				
			}
	
		}
	)
}

function getDefaultFrame() {
	getJSON(getRootUrl() + "/lora/WattecoSensors/products/"+ currentProduct + ".json?v=" + (new Date()).getTime(),
		function(err, currentProduct) {
			if (err !== null) {
				console.log('Une erreur est survenue : ' + err);
			} else {
				if(currentProduct.defaultFrame == undefined){
					currentDefaultFrame = ["0"];
				}else{
					currentDefaultFrame = currentProduct.defaultFrame;
				}
								
			}
	
		}
	)
}
function getDefaultAddresses() {
	getJSON(getRootUrl() + "/lora/WattecoSensors/products/"+ currentProduct + ".json?v=" + (new Date()).getTime(),
		function(err, currentProduct) {
			if (err !== null) {
				console.log('Une erreur est survenue : ' + err);
			} else {
				if(currentProduct.addresses != undefined){

					currentDefaultAddresses[0] = currentProduct.addresses[0] + "\n";
					currentDefaultAddresses[1] = currentProduct.addresses[1] + "\n";
				}else{
					currentDefaultAddresses = ["@10a00\n","@10bfe\n"];
				}
								
			}
	
		}
	)
}

//--------------------------------------------------------------------------------------------------
//	PARTIE 3 : Fonctions de gestion de l'affichage des paramètres disponibles
//--------------------------------------------------------------------------------------------------


//Fonction appelée lors de la modification du produit choisi par l'utilisateur
function switchProduct() {
	resetData("product"); //Nettoyage des données affichées concernant le précédent produit
	currentProduct = document.getElementById("productSelect").value; //Récupération du nom du produit choisi
	if (gLocalConfiguration){
		gFileLoaded = false;
		gDataConcatenation = ""; // nettoyage des données pour OTA précédente
		gDataConcatenateLength = Number(gDataConcatenation.length) ; // Nettoyage de la longueur des données pour OTA
		rndHex = rndHexValue(4);
		gRandValueConfig = currentDefaultAddresses[1] + addSpace(rndHex) + "\nq";
		getEmbeddedProductName();
		getDefaultFrame();
		getDefaultAddresses();
		fSelectCom();
		fSelectFile();
		// Cela sert à garder le fichier selectionné en mémoire
		if (gDeviceList != ''){
			
			fShowFile();

		}

		confButton();
		setInterval("callGetTXT()", refreshTiming);
		callGetTXT(); 

		if(document.getElementById("selectConfig") == null){
			var selectConfigDiv = document.createElement("DIV");
			selectConfigDiv.id = "selectConfig";
			
			var selectConfig = document.createElement("INPUT");
			selectConfig.setAttribute("id", "selectFile");
			selectConfig.setAttribute("type", "file");
			selectConfig.setAttribute("multiple", "");
			selectConfig.setAttribute("accept", ".txt");
			selectConfig.onclick = function () {
				selectConfig.value = null
				showLocalBlock();
				fShowFile();
				showLocalConf();
				document.getElementById("switchLabel").setAttribute("style", "display:none")
			};
			selectConfig.onchange = function() {loadFile(selectConfig.files)};
	
			var labelSelectConfig = document.createElement("label");
			labelSelectConfig.textContent = langData.finalConfigLoadFile[lang];
			selectConfigDiv.appendChild(labelSelectConfig);
	
			selectConfigDiv.appendChild(selectConfig);
			document.getElementById("localSetupConfig").appendChild(selectConfigDiv);
		}
		
	
	}
	
	getJSON(getRootUrl() + "/lora/WattecoSensors/products/" + currentProduct + ".json?v=" + (new Date()).getTime(), //Récupération des données de ce produit à partir du fichier .json correspondant
		function(err, productData) { //Ces données sont enregistrées dans la variable "productData"
			if (err !== null) {
				console.log('Une erreur est survenue : ' + err); //Affiché dans la console en cas d'erreur de récupération des données
			} else {
				currentProductData = productData; //On enregistre les données du produit dans la variable globale correspondante
				
				if (currentProductData != null){
					var productSubSelect = document.getElementById("productSubSelect");
					var productSubSelectLabel = document.getElementById("productSubSelectLabel");
					for (a in productSubSelect.options) {productSubSelect.options.remove(0);};
					if (typeof currentProductData.subProductSelector === 'undefined') {
						productSubSelect.style.display = 'none';
						productSubSelectLabel.style.display = 'none';
					} else {
						currentProductData.subProductSelector.forEach(function(obj) { 
							var opt = document.createElement('option');
							opt.appendChild(document.createTextNode((Array.isArray(obj.name) ? obj.name[lang] : obj.name)));
							opt.value = obj.subProductID;
							productSubSelect.appendChild(opt);
						})
						productSubSelect.style.display = 'inline-block';
						productSubSelectLabel.style.display = 'inline-block';
					}
				}
				//updateFunctionsList(0);	
				populateProductClusters(0);			
			}
		}
	);
}

//Fonction appelée lors de la modification du produit associé choisi par l'utilisateur
function switchSubProduct() {
	resetData("subProduct"); //Nettoyage des données affichées concernant le précédent produit associé
	currentSubProduct = document.getElementById("productSubSelect").value; //Récupération du nom du produit choisi
	//updateFunctionsList(0);	
	populateProductClusters(0);	
}


//Fonction permettant de modifier les fonctions proposées
function switchMode() {
	resetData("category"); //Nettoyage des données affichées concernant la précédente commande
	currentSubProduct = document.getElementById("productSubSelect").value; //Récupération du nom du produit choisi
	currentSelectedMode = parseInt(document.getElementById('modeSelect').value);
	//var selectedMode = parseInt(document.getElementById('modeSelect').value);	
	//updateFunctionsList(selectedMode);
	populateProductClusters(0);
}

// ARRAY STORING ALL REQUIRED PRODUCT CLUSTERS.
// This array is build from all different JSON descriptions that can contain templates (populateXXXX functions below)
gProductClustersArray = [];

function populateSubParametersListTemplates(PopulatedClusterIndex, ClusterIndex,AttributeIndex,CommandIndex=0,ParameterIndex=0) {
	clusterData = gProductClustersArray[PopulatedClusterIndex];

	commandData = clusterData.attributes[AttributeIndex].commands[0];
	if (typeof(commandData.ReportType) !== 'undefined') commandData = commandData.ReportType[0];
	commandData.parameters[5].subParameters.forEach(subParameter => {
		parameterData = subParameter;
		if (typeof(parameterData) !== 'undefined'){
			if (typeof(parameterData.SubParametersListTemplate) !== 'undefined') {			
				// make eventual variable substitution
				SubParametersListTemplate = parameterData.SubParametersListTemplate.replace('&ClusterID',clusterData.clusterID);
				SubParametersListTemplate = SubParametersListTemplate.replace('&AttributeID',clusterData.attributes[AttributeIndex].AttributeID);
				// Look for specified template
				getJSON2(getRootUrl() + "/lora/WattecoSensors/clusters/" + SubParametersListTemplate + ".json?v=" + (new Date()).getTime(), //Récupération des données du cluster
					function(err, obj, params) { 
						if (err !== null) {
							console.log('Une erreur est survenue : ' + err); //Affiché dans la console en cas d'erreur de récupération des données
						} else {
							// Add commands
							clusterData = gProductClustersArray[PopulatedClusterIndex];
							attributeData = clusterData.attributes[params.AttributeIndex];
							attributeData.commands[0].ReportType[0].parameters[5].subParameters[ParameterIndex] = obj.parameters;
						}
					},
					{"PopulatedClusterIndex":PopulatedClusterIndex, "ClusterIndex": ClusterIndex, "AttributeIndex":AttributeIndex, "CommandIndex":CommandIndex, "ParameterIndex":ParameterIndex }
				);
				return;
			}
		}
		ParameterIndex++;
	});
		
	
	populateCommandsTemplates(PopulatedClusterIndex,ClusterIndex,AttributeIndex + 1);
}
function populateCommandsTemplates(PopulatedClusterIndex, ClusterIndex,AttributeIndex=0) {
	clusterData = gProductClustersArray[PopulatedClusterIndex];
	while (AttributeIndex < clusterData.attributes.length) { 
		attributeData = clusterData.attributes[AttributeIndex];
		if (typeof(attributeData) !== 'undefined'){
			if (typeof(attributeData.CommandsTemplate) !== 'undefined') {
				getJSON2(getRootUrl() + "/lora/WattecoSensors/clusters/" + attributeData.CommandsTemplate + ".json?v=" + (new Date()).getTime(), //Récupération des données du cluster
					function(err, obj, params) { 
						if (err !== null) {
							console.log('Une erreur est survenue : ' + err); //Affiché dans la console en cas d'erreur de récupération des données
						} else {
							// Add commands
							clusterData = gProductClustersArray[params.PopulatedClusterIndex];
							attributeData = clusterData.attributes[params.AttributeIndex];
							attributeData.commands = obj.commands;
							populateSubParametersListTemplates(params.PopulatedClusterIndex, params.ClusterIndex,params.AttributeIndex,0,0);
						}
					},
					{"PopulatedClusterIndex":PopulatedClusterIndex, "ClusterIndex": ClusterIndex, "AttributeIndex":AttributeIndex}
				);
				return;
			}
		}
		AttributeIndex++;
	}
	populateProductClusters(ClusterIndex + 1);
}
function populateFieldIndexList(){
	// Specific for TIC batches dynamically created list of available fields
	var lAllFields = currentClusterData.attributes[currentAttributeIndex].commands[0].ReportType[0].parameters[5].subParameters[1];
	
	var select = document.getElementById("parameter0");
	select.options.length = 0;

	for(var i = 0; i < lAllFields.length ; i++){
		if ((lAllFields[i].selectable || lAllFields[i].editable)) {
			if (lAllFields[i]["type"] == "number") {

				// Populate TIC Batch HMI fieldIndex (first refresh)
				var option = document.createElement("OPTION");
				option.text = [lAllFields[i]["ParameterID"] + " : " + (lAllFields[i]["comment"][lang]=="" ? lAllFields[i]["comment"][1] : lAllFields[i]["comment"][lang])];
				option.value = i;

				// Store TIC specific option list for Batch for next refresh (change reportType/addParameterRow)
				var optionObject = lAllFields[i];
				optionObject.fieldIndex = i;
				optionObject.name = ["",""]; // Keep the label as formated before for next refreshs (Cf addParameterRow, from select ReportType)
				optionObject.name[lang] = option.text;
				optionObject.OptionID = i; // keep also the option ID also as used later for select fields
				currentClusterData.attributes[currentAttributeIndex].commands[0].ReportType[1].parameters[2].options[i] = optionObject;
				
				select.add(option);
			}
		}
	}

	
}
function populateProductClusters(ClusterIndex=0) { 
	if (ClusterIndex == 0) {gProductClustersArray.length = 0;}; // First empty populated array
	while (ClusterIndex < currentProductData.clusters.length) {
		currentCluster = currentProductData.clusters[ClusterIndex];
		if (typeof(currentCluster) !== 'undefined'){
			if ((typeof(currentCluster.subProductID) == 'undefined') || (currentCluster.subProductID.indexOf(currentSubProduct) > -1)) {
				getJSON2(getRootUrl() + "/lora/WattecoSensors/clusters/" + currentCluster.clusterID + ".json?v=" + (new Date()).getTime(), //Récupération des données du cluster
					function(err, clusterData,params) { //Ces données sont enregistrées dans la variable "clusterData"
						if (err !== null) {
							console.log('Une erreur est survenue : ' + err); //Affiché dans la console en cas d'erreur de récupération des données
						} else {
							// Add cluster def in Array
							clusterData.endpoints = currentCluster.endpoints;
							clusterData.customName = currentCluster.customName;
							if(clusterData.endpoints.length ==1){
								clusterData.endpointsComment = currentCluster.endpointsComment;
							}else{
								clusterData.endpointsComment = currentCluster.endpointsComment.slice();
							}
							if(typeof(currentCluster["Data.range"]) !== 'undefined') clusterData.range = currentCluster["Data.range"];
							if(typeof(currentCluster["Data.unit"]) !== 'undefined') clusterData.unit = currentCluster["Data.unit"];
							if(typeof(currentCluster["customAttributes"]) !== 'undefined') clusterData.customAttributes = currentCluster["customAttributes"];
							if(typeof(currentCluster.minMaxReport) !== 'undefined') clusterData.minMaxReport = currentCluster.minMaxReport;
							if (typeof(currentCluster.subProductID) !== 'undefined') clusterData.subProductID = currentSubProduct;
							clusterData.TICAttributeInstances = currentCluster.TICAttributeInstances;
							gProductClustersArray.push(clusterData);
							PopulatedClusterIndex = gProductClustersArray.length-1;
							populateCommandsTemplates( PopulatedClusterIndex, params.ClusterIndex,0);
						}
					},
					{"ClusterIndex": ClusterIndex}
				);
				return;
			}
		}
		ClusterIndex++;
	}
	// Finally Make necessary display
	updateFunctionsList(currentSelectedMode);
}

// Following function display Product Clusters Array 
function updateFunctionsList(currentSelectedMode) { 
	// Affichage de la liste finale des clusters

	document.getElementById('functionContainer').innerHTML = "<div style='margin-bottom: 15px;'><label for='paramSelect' style='font-size: 16px;'>② <span style='font-size: 16px;'>" + langData.chooseFunctionMsg[lang] + "</span> </label><select onchange='switchCategory();' id='paramSelect' style='margin-right:10px;'><option value='' selected disabled >----</option></select><select onchange='switchMode();' id='modeSelect' style='width:100px;'><option value='0' " + (currentSelectedMode == 0 ? " selected" : "") + ">" + langData.simple[lang] + "</option><option value='1' " + (currentSelectedMode == 1 ? " selected" : "") + ">" + langData.advanced[lang] + "</option></select></div>"; //On crée le select pour les commandes disponibles
	for(var clusterIndex in gProductClustersArray) {
		currentCluster = gProductClustersArray[clusterIndex]; 
		
		if ("clusterSpecificJS" in currentCluster) window.eval(currentCluster.clusterSpecificJS);

		if(((currentSelectedMode == 0) && (!currentCluster.expert)) || (currentSelectedMode == 1)) {
			var optgroup = document.createElement('optgroup'); //Création d'un groupe d'options
			optgroup.label = (typeof currentCluster.customName !== 'undefined' ? currentCluster.customName[lang] : currentCluster.clusterName[lang]); //Affectation du nom du cluster actuel comme nom de ce groupe d'options
			optgroup.id = "productConfigOption"; //Définition de l'identifiant de l'élément HTML
			for(var attributeIndex in currentCluster.attributes) { //Pour chacun des attributs dans ce cluster par identifiant de position "currentAttribute"
			currentAttribute = currentCluster.attributes[attributeIndex];
				for(var commandIndex in currentAttribute.commands) { //Pour chacune des commandes dans cet attribut par identifiant de position "currentCommand"
					currentCommand = currentAttribute.commands[commandIndex];
					//  si mode d'affichage simple et cluster de niveau expert OU si niveau d'affichage avancé
					if(((currentSelectedMode == 0) && (!currentCommand.expert)) || (currentSelectedMode == 1)) {
						// currentCluster.customAttributes.
						disabled = 0;
						if(typeof(currentCluster["customAttributes"]) !== 'undefined') {
							CustAttr = currentCluster.customAttributes.find( record => record.attribute === currentAttribute.AttributeID);
							if(typeof(CustAttr) !== 'undefined')
								if(typeof(CustAttr["disabled"]) !== 'undefined') {
									disabled = CustAttr.disabled;
								}
						}
						if (!disabled) {
							var opt = document.createElement('option'); //Création d'une option
							opt.appendChild(document.createTextNode(currentCommand.name[lang].replace('&AttributeID',currentAttribute.AttributeID))); //Donner à cette option le nom de la commande correspondante
							opt.value = currentCluster.clusterID + "\t" + attributeIndex + "\t" + commandIndex; //Affectation à cette option d'une valeur du type : clusterID_AttributeIndex_CommandIndex
							optgroup.appendChild(opt); //Ajout de cette option dans le groupe d'options précédemment créé
						}
					}
				}
			}
			document.getElementById('paramSelect').appendChild(optgroup); //Ajout du groupe d'options dans le sélecteur de commande
		}
	}	
}

function EndPointCallBack(obj) {
	
	UpdateFieldsOfEndPointDependantParameters();
	
	modifyParameter();
}

//Fonction appelée lors de la modification de la commande choisie par l'utilisateur
function switchCategory(lCurrentReportType = 0) {
	//Nettoyage des données affichées concernant la précédente commande
	
	var selected = document.getElementById("paramSelect").value.split("\t"); //Récupération de l'arborescence de la commande choisie 
	currentCluster = selected[0]; //Sauvegarde du cluster correspondant dans la variable globale "currentCluster"
	currentAttributeIndex = parseInt(selected[1]); //Sauvegarde de l'attribut correspondant dans la variable globale "currentAttribute"
	currentCommandIndex = parseInt(selected[2]); //Sauvegarde de la commande correspondante dans la variable globale "currentCommand"
	currentReportType = lCurrentReportType;
	var clusterData = gProductClustersArray.find(clusterData => clusterData.clusterID === currentCluster);
	currentAttributeName = clusterData.attributes[currentAttributeIndex].AttributeID;
	
	if(currentProductData.clusters.find(cluster => cluster.clusterID == currentCluster).customAttributes != undefined){
		currentCustomData = currentProductData.clusters.find(cluster => cluster.clusterID == currentCluster).customAttributes.find(attribute => attribute.attribute == currentAttributeName);
	}else{
		currentCustomData = null;
	}
	currentClusterData = clusterData; //On enregistre les données du cluster dans la variable globale correspondante
	document.getElementById('configContainer').innerHTML = "<p><span style='font-size: 16px;'>③ </span>" + langData.editParameterMsg[lang] + "</p><table id='configTable' class='tablepress'></table>"; //Création du tableau qui va contenir les paramètres modifiables
	var configTable = document.getElementById('configTable'); //On récupère l'élément tableau créé
	
	var header = configTable.createTHead(); //Création du header du tableau (contiendra les titres des colonnes)
	var row = header.insertRow(0); //Insertion d'une ligne dans le header

	row.insertCell(0).outerHTML = "<th>" + langData.parameter[lang] + "</th>"; //Insertion d'une cellule contenant le mot "Paramètre"
	zeValueHeader="<div style='float: left;'>"+langData.value[lang]+"</div>";
	if(currentCluster.startsWith("TIC"))
		zeValueHeader+="<div style='float: right;'>"+langData.TICHeaderSelect[lang]+"</div>";
	row.insertCell(1).outerHTML = "<th>" + zeValueHeader + "</th>"; //Insertion d'une cellule contenant le mot "Valeur"
	row.insertCell(2).outerHTML = "<th>" + langData.comment[lang] + "</th>"; //Insertion d'une cellule contenant le mot "Commentaire"
	
	var body = configTable.createTBody(); //Création du contenu du tableau
	
	var i = 0; //Initialisation d'une variable locale "i" égale à 0
	
	if (clusterData.endpoints != null) { //Si le cluster actuellement traité par la boucle est bien le cluster actuel
		var row = body.insertRow(i); //Insérer une ligne dans le tableau créé précédemment
		row.insertCell(0).innerHTML = langData.endpoint[lang]; //Insertion du texte dans la première cellule
		row.insertCell(1).innerHTML = "<select id='endpointSelect' onchange='EndPointCallBack(this)' ></select>"; //Insertion du choix de l'EndPoint dans la seconde cellule
		
		var select = document.getElementById("endpointSelect"); //On récupère l'élément select tout juste créé
		clusterData.endpoints.forEach(function(element) { //Pour chaque EndPoint disponible pour le cluster actuel
			var opt = document.createElement('option'); //On ajoute une nouvelle option
			opt.appendChild(document.createTextNode(element)); //On lui donne comme nom le numéro de l'EndPoint
			opt.value = element; //De même pour sa valeur
			select.appendChild(opt); //On ajoute notre option à la liste select précédente
		});
		
		row.insertCell(2).innerHTML = Array.isArray((clusterData.endpointsComment[lang])) ? clusterData.endpointsComment[document.getElementById('endpointSelect').value][lang]: clusterData.endpointsComment[lang]; //Remplissage de la troisième cellule
		i++; //Incrémentation de la variable i
	};

	var attributeData = clusterData.attributes[currentAttributeIndex];
	var commandData = attributeData.commands[currentCommandIndex];

	if(currentCustomData != null && commandData.CommandID === "ConfigureReporting"){
		if(commandData.ReportType == undefined){
			if(currentCustomData["Data.range"] != undefined) commandData.parameters.find(parameter => parameter.ParameterID == "Data").range = currentCustomData["Data.range"][Number(document.getElementById("endpointSelect").selectedIndex)];
			if(currentCustomData["Data.unit"] != undefined) commandData.parameters.find(parameter => parameter.ParameterID == "Data").unit = currentCustomData["Data.unit"][Number(document.getElementById("endpointSelect").selectedIndex)];
		}else{
			if(currentReportType == 0){
				if(currentCustomData["Data.range"] != undefined) commandData.ReportType[currentReportType].parameters.find(parameter => parameter.ParameterID == "Data").range = currentCustomData["Data.range"][Number(document.getElementById("endpointSelect").selectedIndex)];
				if(currentCustomData["Data.unit"] != undefined) commandData.ReportType[currentReportType].parameters.find(parameter => parameter.ParameterID == "Data").unit = currentCustomData["Data.unit"][Number(document.getElementById("endpointSelect").selectedIndex)];
			}else{
				if(currentCustomData["Data.range"] != undefined) commandData.ReportType[currentReportType].parameters.find(parameter => parameter.ParameterID == "Delta").range = currentCustomData["Data.range"][Number(document.getElementById("endpointSelect").selectedIndex)];
				if(currentCustomData["Data.unit"] != undefined) commandData.ReportType[currentReportType].parameters.find(parameter => parameter.ParameterID == "Delta").unit = currentCustomData["Data.unit"][Number(document.getElementById("endpointSelect").selectedIndex)];

				if(currentCustomData["Data.range"] != undefined) commandData.ReportType[currentReportType].parameters.find(parameter => parameter.ParameterID == "Resolution").range = currentCustomData["Data.range"][Number(document.getElementById("endpointSelect").selectedIndex)];
				if(currentCustomData["Data.unit"] != undefined) commandData.ReportType[currentReportType].parameters.find(parameter => parameter.ParameterID == "Resolution").unit = currentCustomData["Data.unit"][Number(document.getElementById("endpointSelect").selectedIndex)];
			}
			
		}
	
	} 
	currentCommandParameters = null; //On réinitialise la variable indiquant les paramètres actuels
	if(commandData.ReportType == null) { //Si la commande ne présente pas plusieurs types de rapports possibles
		if(commandData.parameters != null) { //Si la commande présente des paramètres
			currentCommandParameters = commandData.parameters; //Enregister ces paramètres dans la variable "currentCommandParameters"
		}
	} else { //Sinon
		var row = body.insertRow(i); //Insérer une nouvelle ligne dans le tableau
		row.insertCell(0).innerHTML = langData.report[lang]; //Remplir la première cellule avec le label du type de rapport
		row.insertCell(1).innerHTML = 
			"<select onchange='modifyReportType();' id='reportSelect'>"+
			"<option value='0'" + (currentReportType == 0 ? " selected" : "") + ">Standard</option>" +
				(typeof attributeData.commands[currentCommandIndex].ReportType[1] !== 'undefined' && checkBatchAvailability() ?
				("<option value='1'" + (currentReportType == 1 ? " selected" : "") + ">Batch</option>") : "") +
			"</select>"; //On crée le sélecteur de type de rapport dans la seconde cellule
		row.insertCell(2).innerHTML = "---"; //Remplissage de la troisième cellule
		i++;
		
		if(commandData.ReportType[currentReportType].parameters != null) { //Si la commande rpésente des paramètres
			currentCommandParameters = commandData.ReportType[currentReportType].parameters; //Enregister ces paramètres dans la variable "currentCommandParameters"
		}
	}
	
	thresholdAvailable = false;
	if(currentCommandParameters != null) { //Si des paramètres modifiables sont disponibles pour la commande choisie
		parameterIndex = 0; //Création d'une variable contenant le numéro d'index du paramètre actuel initialisée à 0
		
		// On vérifie si on a un threshold et si oui, on applique des fonctions et reset des paramètres
		getThreshold(clusterData,body);
		if (thresholdAvailable   && commandData.CommandID === "ConfigureReporting"){
			obj = [];
			allThreshold = [];
			dynamicButtonCase =[];
			addParameterThresh(body);
			while(body.rows[body.rows.length-1].id != 'stopHere'){
				body.deleteRow(-1);
			}
			document.getElementById("firstAddButton").click();
		}
					
		currentCommandParameters.forEach(function(element) {
			//Pour chacun des paramètres de la commande comme variables locale "element"
			selectable = (typeof(element.selectable)== 'undefined' ? false : element.selectable);
			if ((element.editable) ||(selectable)) { //Si le paramètre est modifiable ou sélectionable on le montre
				if(element.type == "data" || element.type == "array") {
					element.subParameters.forEach(function(subParameter) {
						if(subParameter.editable) {
							if(currentCluster == "Configuration" && currentReportType == 0 && !thresholdAvailable && subParameter.type == "number"){
								if(currentProductData.clusters.find(clusters => clusters.clusterID == currentCluster).availablePowerSource.indexOf(subParameter.fieldIndex) != -1){
															
									addParameterRow(body,i,parameterIndex,subParameter); //Appel de notre fonction d'ajout de ligne
									parameterIndex++; //On incrémente le numéro d'index du paramètre
									i++; //On incrémente "i"
								}
							}
							else{
								addParameterRow(body,i,parameterIndex,subParameter,selectable,undefined); //Appel de notre fonction d'ajout de ligne
									parameterIndex++; //On incrémente le numéro d'index du paramètre
									i++; //On incrémente "i"
							}
						}else if(subParameter.ParameterID == undefined){
							// TIC case
							subParameter.forEach(sub => {
								if (sub.selectable || sub.editable) {
									addParameterRow(body,i,parameterIndex,sub,sub.selectable,sub.editable); //Appel de notre fonction d'ajout de ligne
									parameterIndex++; //On incrémente le numéro d'index du paramètre
									i++; //On incrémente "i"
								}
							});
							
						}
						});
				} else {
					if (element.ParameterID == "Instance" ) {
						element.range = clusterData.TICAttributeInstances;
					} 
					addParameterRow(body,i,parameterIndex,element,undefined,undefined); //Appel de notre fonction d'ajout de ligne
					parameterIndex++; //On incrémente le numéro d'index du paramètre
					i++; //On incrémente "i"
				}
			}
		});
	}
	if(currentCluster == "Configuration" && currentReportType == 0 && !thresholdAvailable){
		selectSource();
	}
	// Si on a le cluster choisis actuel qui permet le report Batch on lance la fonction updateBatchData
	
	if(currentReportType == 1 && checkBatchAvailability() && currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].CommandID !== "ReadReportingConfiguration")
	{

		document.getElementById("parameter0").onchange = function(){updateBatchData()};
		updateBatchData();
	}
	
	document.getElementById('generateButtonContainer').innerHTML = "<p><span style='font-size: 16px;'>④ </span>" + langData.outputSelectMsg[lang] + "</p><table id='generateButtonTable' class='tablepress tablepress-id-11'></table>"; //On crée le tableau qui va contenir le choix du format de sortie
	
	var generateButtonTable = document.getElementById('generateButtonTable'); //On récupère le tableau tout juste créé
	
	var header = generateButtonTable.createTHead(); //On crée l'en-tête du tableau
	var row = header.insertRow(0); //On insère une ligne
	row.insertCell(0).outerHTML = "<th></th>"; //Contenu de la première cellule vide
	row.insertCell(1).outerHTML = "<th style='min-width:100px;'>" + langData.outputFormatTitle[lang] + "</th>"; //Contenu de la seconde cellule "Output format"
	row.insertCell(2).outerHTML = "<th>" + langData.outputFormatDesc[lang] + "</th>"; //Contenu de la troisième cellule "Description"
	row.insertCell(3).outerHTML = "<th>" + langData.addOutput[lang] + "</th>"; //Contenu de la quatrième cellule "Generate"
	if(gLocalConfiguration) row.insertCell(4).outerHTML = "<th>" + langData.resetOutput[lang] + "</th>" ; //Contenu de la cinquième cellule "Reset"
	if(gLocalConfiguration) row.insertCell(5).outerHTML = "<th>" + langData.resetConfFrame[lang] + "</th>"; //Contenu de la sixième cellule "ResetConfFrame"
	
	var body = generateButtonTable.createTBody(); //On crée le corps du tableau
	
	if (!gLocalConfiguration){
		//Si nous ne somme pas en local cela met Frame et JSON  
		//Remplissage de la première ligne du tableau pour le format "Frame"
		var row = body.insertRow(0); //On insère la première ligne
		row.insertCell(0).innerHTML = "<span style='font-size: 16px;'>Ⓐ</span>"; //Esthétisme (A)
		row.insertCell(1).innerHTML = langData.frame[lang]; //Nom du format de sortie
		row.insertCell(2).innerHTML = langData.frameDesc[lang]; //Description du format de sortie
		
		var generateButton = document.createElement('input'); //Création d'un élément d'entrée
		generateButton.type = "button"; //Définition de l'élément comme bouton
		generateButton.value = langData.chooseOutput[lang]; //Texte du bouton
		generateButton.onclick = function() { showFinalFrame(); }; //Cliquer sur le bouton appelle la fonction d'affichage de la trame
		row.insertCell(3).appendChild(generateButton); //Insertion du bouton dans la troisième cellule
		
		//Remplissage de la deuxième ligne du tableau pour le format "JSON"
		var row = body.insertRow(1); //On insère la deuxième ligne
		row.insertCell(0).innerHTML = "<span style='font-size: 16px;'>Ⓑ</span>"; //Esthétisme (B)
		row.insertCell(1).innerHTML = "JSON"; //Nom du format de sortie
		row.insertCell(2).innerHTML = langData.jsonDesc[lang]; //Description du format de sortie
		
		var generateButton = document.createElement('input'); //Création d'un élément d'entrée
		generateButton.type = "button"; //Définition de l'élément comme bouton
		generateButton.value = langData.chooseOutput[lang]; //Texte du bouton
		generateButton.onclick = function() { showFinalJson(); }; //Cliquer sur le bouton appelle la fonction d'affichage du JSON
		row.insertCell(3).appendChild(generateButton); //Insertion du bouton dans la troisième cellule
	} else{
		// Si nous sommes en local cela met le Texte
		//Remplissage de la première ligne du tableau pour le format "Texte"
		var row = body.insertRow(0); //On insère la première ligne
		row.insertCell(0).innerHTML = "<span style='font-size: 16px;'>Ⓐ</span>"; //Esthétisme (C)
		row.insertCell(1).innerHTML = langData.text[lang]; //Nom du format de sortie
		row.insertCell(2).innerHTML = langData.txtDesc[lang]; //Description du format de sortie

		var generateButton = document.createElement('input'); //Création d'un élément d'entrée
		generateButton.type = "button"; //Définition de l'élément comme bouton
    generateButton.id = "addFrameButton"; // Mise en place d'un id
		generateButton.value = langData.chooseOption[lang]; //Texte du bouton
		generateButton.onclick = function() { showFinalTxt(generateCheckbox.checked,true)}; //Cliquer sur le bouton appelle la fonction de création du fichier txt et du téléchargement de celui ci
		row.insertCell(3).appendChild(generateButton); //Insertion du bouton dans la troisième cellule	
		
		var generateButton = document.createElement('input'); //Création d'un élément d'entrée
		generateButton.type = "button"; //Définition de l'élément comme bouton
    generateButton.id = "resetFrameButton"; // Mise en place d'un id
		generateButton.value = langData.chooseOption[lang]; //Texte du bouton
		generateButton.onclick = function() { resetShowFinalTxt(generateCheckbox.checked); }; //Cliquer sur le bouton appelle la fonction de création du fichier txt et du téléchargement de celui ci
		row.insertCell(4).appendChild(generateButton); //Insertion du bouton dans la troisième cellule
		
		var generateCheckbox = document.createElement('input'); //Création d'un élément d'entrée
		generateCheckbox.type = "checkbox"; //Définition de l'élément comme bouton
		generateCheckbox.id = "checkboxResetId"; 
		generateCheckbox.checked = true;
		generateCheckbox.onclick = function() { showFinalTxt(generateCheckbox.checked,false); }; //Cliquer sur le bouton appelle la fonction de création du fichier txt et du téléchargement de celui ci
		row.insertCell(5).appendChild(generateCheckbox); //Insertion du bouton dans la troisième cellule
	}

	SetInputMaskMngt();
	
}	

function getParameterInfos(parameter,infos) {
	// Infos output will be :  infos = { unit: "", comment : "", range: [], EndPointDependant: false };
	
	infos.unit = parameter.unit[lang];
	infos.comment = parameter.comment[lang] == "" ? parameter.comment[1] :  parameter.comment[lang];
	infos.range = parameter.range;
	infos.EndPointDependant = false;
		
	var endpoint = document.getElementById("endpointSelect");
	
	if(endpoint != null) {
		EndPointValue = parseInt(endpoint.value);
	} else {
		EndPointValue = 0;
	}
	
	currentProductData.clusters.forEach(function(selectedCluster){
		if (selectedCluster.clusterID == currentCluster) {
			//Look for customAttributes by endpoint
			if (Array.isArray(selectedCluster["customAttributes"]) && !(parameter.ParameterID).startsWith("Tag") && parameter.type != "time") {
				infos.EndPointDependant = true;
				if(currentCustomData["Data.range"] != undefined) infos.range = currentCustomData["Data.range"][EndPointValue];
				if(currentCustomData["Data.unit"] != undefined) infos.unit = currentCustomData["Data.unit"][EndPointValue][lang];
				if(currentCustomData["Data.comment"] != undefined) infos.comment = currentCustomData["Data.comment"][EndPointValue][lang];
				} 
			

			// Look for UNIT defined by EndPoint or for all Enpoint or keep the one defined at parameter level
			theID = parameter.ParameterID + ".unit";
			if (Array.isArray(selectedCluster[theID])) {
				if (Array.isArray(selectedCluster[theID][0])) {
					if (Array.isArray(selectedCluster[theID][EndPointValue])) { 
						infos.unit = selectedCluster[theID][EndPointValue][lang];
						infos.EndPointDependant = true;
					} else { 
						infos.unit = selectedCluster[theID][0][lang];
					}
				} else {
					infos.unit = selectedCluster[theID][lang]; 
				} 
			};
			// Look for COMMENT defined by EndPoint or for all Enpoint or keep the one defined at parameter level
			theID = parameter.ParameterID + ".comment";
			if (Array.isArray(selectedCluster[theID])) {
				if (Array.isArray(selectedCluster[theID][0])) {
					if (Array.isArray(selectedCluster[theID][EndPointValue])) { 
						infos.comment = selectedCluster[theID][EndPointValue][lang];
						infos.EndPointDependant = true;
					} else { 
						infos.comment = selectedCluster[theID][0][lang];
					}
				} else {
					infos.comment = selectedCluster[theID][lang]; 
				} 
			};
			// Look for RANGE defined by EndPoint or for all Enpoint or keep the one defined at parameter level
			theID = parameter.ParameterID + ".range";
	
			if (Array.isArray(selectedCluster[theID])) {
				if (Array.isArray(selectedCluster[theID][0])) {
					if (Array.isArray(selectedCluster[theID][EndPointValue])) { 
						infos.range = selectedCluster[theID][EndPointValue];
						infos.EndPointDependant = true;
					} else { 
						infos.range = selectedCluster[theID][0];
					}
				} else {
					infos.range = selectedCluster[theID]; 
				} 
			};
		}
	});
}	


function UpdateStdFields(parameter,infos, editable = true) {
	if(editable){
		parameter.row.cells[1].innerHTML = 
		"<input type='number' step='" + (1/(parameter.mantissa)) + 
			"' value='" + ("value" in parameter ? parameter.value : (Array.isArray(infos.range) ? infos.range[0]:0)) + "' " +
			(Array.isArray(infos.range) ? " min='" + infos.range[0] + "' max='" + infos.range[1] + "' "  : "") + 
			"onchange='modifyParameter()' id='parameter" + parameter.index + 
			"'> " + infos.unit ; //Insertion du champ pour rentrer la valeur correspondant à l'option
		
		parameter.row.cells[2].outerHTML = 
			"<td id='interval" + parameter.index + "'>" + infos.comment + 
			(Array.isArray(infos.range) || (infos.unit[lang] != "") ?
			" (" + (Array.isArray(infos.range) ? infos.range[0] + " " + langData.to[lang] + " " + infos.range[1] + " " : "") +
			infos.unit + ")</td>"
			: "")
	}else{
		parameter.row.cells[1].innerHTML = "" ; //Insertion du champ pour rentrer la valeur correspondant à l'option
	
	parameter.row.cells[2].outerHTML = 
		"<td id='interval" + parameter.index + "'>" + infos.comment + 
		(Array.isArray(infos.range) || (infos.unit[lang] != "") ?
		" (" + (Array.isArray(infos.range) ? infos.range[0] + " " + langData.to[lang] + " " + infos.range[1] + " " : "") +
		infos.unit + ")</td>"
		: "");
	}	
	
	
}

function UpdateFieldsOfEndPointDependantParameters() {
	
	EndPointDependantParametersList.forEach(function(parameter){
		var infos = { unit: "", comment : "", range: [], EndPointDependant: false  };
		getParameterInfos(parameter,infos );
		UpdateStdFields(parameter,infos);
	});
	if(Array.isArray(currentClusterData.endpointsComment[lang])){
		document.getElementById("endpointSelect").parentElement.nextElementSibling.innerHTML = currentClusterData.endpointsComment[document.getElementById("endpointSelect").value][lang]
	}
	if(checkBatchAvailability() && currentReportType == 1){
		updateBatchData();
	}
}

//Fonction permettant de rafraichir toutes les données du batch (le grisement des cases, les configs, l'affichage des fieldIndex)
function updateBatchData(){
	var allConfigBatch = [];
	currentProductData.clusters.forEach(function(el){
		if(el.clusterID === currentCluster){
			el.batch.forEach(function(element){
				if(element.attribute === currentClusterData.attributes[currentAttributeIndex].AttributeID){
					if(element.config != undefined){
						allConfigBatch = element.config;
						if(allConfigBatch.length != 0){
							//On récupère les différents fieldIndex des config dispo par endpoint dans une liste
							var availableField = [];
							for(config in allConfigBatch[Number(document.getElementById("endpointSelect").selectedIndex)]){
								availableField.push(allConfigBatch[Number(document.getElementById("endpointSelect").selectedIndex)][config][0]);
							}
							// Si les des options ne sont pas dans les fiedIndex dispo on les enlève
							var options = document.getElementById("parameter0").options;
							for(let i=0;i<options.length;i++){
								if(!availableField.includes(Number(options[i].value))){
									document.getElementById("parameter0").removeChild(options[i]);
									i--;
								}
							}
						}
						var fieldIndexFinder = element.config[Number(document.getElementById("endpointSelect").selectedIndex)].findIndex(config => config[0] == document.getElementById("parameter0").value);
						
						
						configBatch = element.config[Number(document.getElementById("endpointSelect").selectedIndex)][fieldIndexFinder];
					}else{
						var lConfigBatch = [];
						var lCurrentProductData = currentProductData.clusters.find(clusters => clusters.clusterID == currentCluster);
						if(lCurrentProductData.availablePowerSource != undefined){
							for(var i=0;i<currentProductData.availablePowerSource.length;i++){
								lConfigBatch.push([0,1,0,1]);
							}
						}else{
							lConfigBatch.push([0,1,0,1]);
						}
						for(var i=0;i<lCurrentProductData.endpoints.length;i++){
							allConfigBatch.push(lConfigBatch);
							
						}
						configBatch = [0,1,0,1];
						
						if(allConfigBatch.length != 0){
							//On récupère les différents fieldIndex des config dispo par endpoint dans une liste
							var availableField = [];
							for(config in allConfigBatch[Number(document.getElementById("endpointSelect").selectedIndex)]){
								availableField.push(allConfigBatch[Number(document.getElementById("endpointSelect").selectedIndex)][config][0]);
							}
							// Si les des options ne sont pas dans les fiedIndex dispo on les enlève
							var options = document.getElementById("parameter0").options;
							if (!(availableField.length == 1 && availableField[0] == 0)) { // Ne rien retirer si pas de config
								for(let i=0;i<options.length;i++){
									if(!availableField.includes(Number(options[i].value))){
										document.getElementById("parameter0").removeChild(options[i]);
										i--;
									}
								}
							}
						}
					}
					
				}
			}
			)
		}
	});
	// Si on a que le FieldIndex 0 ou pas de fieldIndex on cache le select, sinon on n'affiche que les fields qu'on peut modifier
	if(document.getElementById("parameter0").options.length <= 1){
		if(currentCluster.startsWith("TIC")){
			populateFieldIndexList();
		}else{
			document.getElementById("parameter0").parentElement.parentElement.style.display = 'none';
		}

	}
	// Si une range et une unité ont été définis dans le cluster du produit alors on les récupères, ou si il y a plusieurs fieldIndex 
	if(currentClusterData.unit !== undefined || currentClusterData.range !== undefined){
		var currentField = {};
		currentClusterData.range != undefined ? 
			currentField.range = currentClusterData.range[Number(document.getElementById("endpointSelect").selectedIndex)] :
			currentField.range = currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].range;
		currentClusterData.unit != undefined ? 
			currentField.unit = currentClusterData.unit[Number(document.getElementById("endpointSelect").selectedIndex)] : 
			currentField.unit = currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].unit;
		currentField.mantissa = 1;
		currentField.multiplier = 1;
	}else if(document.getElementById("parameter0").options.length > 1 || (document.getElementById("parameter0").options.length == 1 && document.getElementById("parameter0").options[0].textContent !="none")){
		if(currentCluster.startsWith("TIC")){
			var currentField = currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters.length-1].subParameters[1].find(element => element.fieldIndex == document.getElementById("parameter0").value);
		}else{
			var currentField = currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters.length-1].subParameters.find(element => element.fieldIndex == document.getElementById("parameter0").value);
		}
	}
	// Si une des deux conditions précédentes a été réalisées alors on fait les modifications adéquates
	if(currentField !== undefined){
		for(let i=3;i<5;i++){
			// On met à jour les paramètres d'IHM et des paramètres Delta and Resolution information car utilisés après (modifyParameter, generate JSON, ...)
			//idxCmdParam = ((currentCluster.startsWith("TIC")) ? i + 2 : i + 1); // + Instance in TIC parameters
			idxCmdParam = i+2;
			currentCommandParameters[idxCmdParam].mantissa = currentField.mantissa;
			currentCommandParameters[idxCmdParam].multiplier = currentField.multiplier;
			theElement = document.getElementById('parameter'+i);
			//theElement.mantissa = currentField.mantissa;
			//theElement.multiplier = currentField.multiplier;
			theElement.nextSibling.textContent = currentField.unit[lang];
			theElement.step=1/(currentField.mantissa);
			if (currentField.range !== undefined) {
				theElement.min = currentField.range[0];
				theElement.max = currentField.range[1];
				currentCommandParameters[idxCmdParam]["range"] = [currentField.range[0],currentField.range[1]];
				document.getElementById('interval'+i).textContent = "--- (" + currentField.range[0] +", "+currentField.range[0] + ")";
			} 
			else {
				currentCommandParameters[idxCmdParam]["range"]= [0,Infinity];
				document.getElementById('interval'+i).textContent = "--- (>=0)";
			}
		}
	}
	

	//Si on est en mode simple on affiche la config de base et on grise les cases tagsize taglabel et resolution, si on est mode advanced on affiche la config et on dégrise les input 
	if(currentSelectedMode == 0){
		if(configBatch.toString() == "0,0,0,1"){
			document.getElementById("endpointSelect").selectedIndex = 1;
			document.getElementById("endpointSelect").disabled = true;
			configBatch = allConfigBatch[1][0];
		}	
		for(let i=4;i<=6;i++){
			document.getElementById('parameter'+i).value = configBatch[i-3];
			document.getElementById('parameter'+i).disabled = true;
		}
		
	}else{
		if(configBatch.toString() == "0,0,0,1"){
			document.getElementById("endpointSelect").selectedIndex = 1;
			configBatch = allConfigBatch[1][0];
		}
		for(let i=4;i<=6;i++){
			document.getElementById('parameter'+i).value = configBatch[i-3]
			document.getElementById('parameter'+i).disabled = false;
		}
	}
}

function removeAllChildNodes(parent) {
	while (parent.firstChild) {
		parent.removeChild(parent.firstChild);
	}
}

//Fonction permettant d'ajouter une nouvelle ligne de paramètre
function addParameterRow(body,rowIndex,parameterIndex,parameter,selectable = false,editable=true) {
	var cellNum = 0;
	var row = body.insertRow(rowIndex); //Insertion d'une nouvelle ligne dans le tableau
	parameter.row = row;

	//Indication du nom du paramètre dans la première cellule avec éventuelle checkbox de sélection
	cellHtml = "<div style='float: left; text-align: left'>" +
		((typeof(parameter.name) == 'undefined') ? parameter.ParameterID : parameter.name[lang]) + "</div>"

	row.insertCell(cellNum++).innerHTML = cellHtml;

	// Set some default parameters for parameter in case not defined in JSON
	if (! Array.isArray(parameter.unit)) parameter.unit = ["",""];
	if (! Array.isArray(parameter.comment)) parameter.comment = ["---","---"];
	if (parameter.mantissa == undefined){parameter.mantissa = 1;}
	if (parameter.multiplier == undefined) parameter.multiplier = 1;
	
	switch(parameter.type) {
		case "time":
			if (! Array.isArray(parameter.range)) {
				parameter.range = [0,32767];
			} 
			
			var cell = row.insertCell(cellNum++); //Insertion de la deuxième cellule

			var tvalue = -1;
			var tunitindex = 0;
			if ("value" in parameter) {
				try {
					var str = parameter.value;
					match = str.match(/\d*/);
					if (!(typeof match === 'undefined')) _tvalue = parseInt(match[0], 10);
					match = str.match(/[sSmM]/);
					if (!(typeof match === 'undefined')) _tunit = match[0];

					if (_tunit.length > 0) {
						tunitindex = (_tunit[0].toUpperCase() == "M" ? 1 : 0);
					}
					tvalue = _tvalue;
				}
				catch (error) {	}
			}
			cell.innerHTML = "<input type='number' step='1' value='1' "+ 
				" min='" +  parameter.range[0] + "' max='" + parameter.range[1] +"'" +
				"onchange='modifyParameter()' id='parameter" + parameterIndex + "'" +
				"style='margin-right:10px;'><select onchange='switchTimeUnit(" + parameterIndex + ");'" +
				" id='unit" + parameterIndex + "'></select>"; //Insertion des champs d'indication du temps et du choix de l'unité
			
			var unitSelect = document.getElementById("unit" + parameterIndex); //On récupère le sélecteur d'unité tout juste créé
			unitSelect.style.width = "100px"; //On lui indique sa valeur
			
			var seconds = document.createElement('option'); //On crée une option qui correspondra aux secondes
			seconds.appendChild(document.createTextNode(langData.seconds[lang])); //On lui donne le nom de l'unité
			seconds.value = "Seconds"; //On lui indique sa valeur
			unitSelect.appendChild(seconds); //On ajoute l'option dans le sélecteur d'unité
			
			var minutes = document.createElement('option'); //On crée une option qui correspondra aux minutes
			minutes.appendChild(document.createTextNode(langData.minutes[lang])); //On lui donne le nom de l'unité
			minutes.value = "Minutes"; //On lui indique sa valeur
			unitSelect.appendChild(minutes); //On ajoute l'option dans le sélecteur d'unité

			var valueinput = document.getElementById("parameter" + parameterIndex)
			
			if (tvalue >= 0) {
				valueinput.value = tvalue;
				unitSelect.selectedIndex = tunitindex;
			}else{
				if(currentClusterData.minMaxReport != undefined){
					if (parameter.ParameterID === 'MinReport'){
						document.getElementById("parameter" + parameterIndex).value = currentClusterData.minMaxReport[0][0];
						unitSelect.selectedIndex = currentClusterData.minMaxReport[0][1];
					} else if(parameter.ParameterID === 'MaxReport'){
						document.getElementById("parameter" + parameterIndex).value = currentClusterData.minMaxReport[1][0];
						unitSelect.selectedIndex = currentClusterData.minMaxReport[1][1];
					}
				}else{
					if (parameter.ParameterID === 'MinReport'){
						document.getElementById("parameter" + parameterIndex).value = 60;
						unitSelect.selectedIndex = 1;
					} else if(parameter.ParameterID === 'MaxReport'){
						document.getElementById("parameter" + parameterIndex).value = 60;
						unitSelect.selectedIndex = 1;
					} 
				}
			}
			
						
			row.insertCell(cellNum++).outerHTML = "<td id='interval" + parameterIndex + "'>" + 
				parameter.comment[lang] + 
				" (" + parameter.range[0] + " " + langData.to[lang] + " " + parameter.range[1] + " " +
				langData.secondsOrMinutes[lang] + ")</td>"; //On remplit la cellule décrivant l'intervalle avec l'unité correspondante
			
		break;
		
		case "select":
			
			row.insertCell(cellNum++).innerHTML = 
			"<select id='parameter" + parameterIndex + "'" +
			("onChange" in parameter ? "onchange='" + parameter.onChange +"'" : "") +
			"></select>";
			
			var select = document.getElementById("parameter" + parameterIndex); //On récupère l'élément select tout juste créé

			if ("populate" in parameter) {
				removeAllChildNodes(select);
				eval(parameter.populate);
			}
			else
			{
				parameter.options.forEach(function(currentOption) {
					var opt = document.createElement('option'); //On ajoute une nouvelle option
					opt.appendChild(document.createTextNode(currentOption.name === undefined ? currentOption.comment[1] :currentOption.name[lang]));
					opt.value = currentOption.OptionID;
					select.appendChild(opt); //On ajoute notre option à la liste select précédente
				});
			}
			
			currentProductData.clusters.forEach(function(selectedCluster){
				if(selectedCluster.clusterID == currentCluster) {
					row.insertCell(cellNum++).innerHTML = (typeof selectedCluster[parameter.ParameterID + ".comment"] !== 'undefined' ? selectedCluster[parameter.ParameterID + ".comment"][lang] : parameter.comment[lang]); //Remplissage de la troisième cellule
				}
			});

			if ("value" in parameter) {
				select.value = parameter.value;
			}
			
		break;

		case "string":
			var infos = { unit: "", comment : "", range: [], EndPointDependant: false  };
			getParameterInfos(parameter,infos );
			parameter.index = parameterIndex;
			if (infos.EndPointDependant) {
				EndPointDependantParametersList.push(parameter);
			}
			row.insertCell(cellNum++);
			row.insertCell(cellNum++);

			maskParams="";
			if (typeof (parameter.placeholder) != 'undefined') {
				maskParams="placeholder='" + parameter.placeholder +"' data-slots='" + parameter.dataslots + "'";
			}

			parameter.row.cells[1].innerHTML = 
			"<input type='string' value='' onchange='modifyParameter()' id='parameter" + parameter.index + "' " + maskParams + "> "; 
			
			tmpstr = "<td id='interval" + parameter.index + "'>" + infos.comment; 
			if (currentCluster.startsWith("TIC")) {
				if (editable) {
					tmpstr += 
						" (" + langData.TypeString[lang] + ". Cf: <a href='https://support.watteco.com/wp-content/uploads/2020/04/TIC_Application_Layer_Description_1.2.pdf'  target='_blank'>TIC Application Layer, §4 & §6 </a>)"
				} 
			} else {
				tmpstr += (Array.isArray(infos.range) || (infos.unit[lang] != "") ?
				" (" + (Array.isArray(infos.range) ? infos.range[0] + " " + langData.to[lang] + " " + infos.range[1]  : "") + ")" +
				infos.unit 
				: "");
			}
			parameter.row.cells[2].outerHTML = tmpstr + "</td>";
			
		break;

		case "hexa":
			var infos = { unit: "", comment : "", range: [], EndPointDependant: false  };
			getParameterInfos(parameter,infos );
			parameter.index = parameterIndex;
			if (infos.EndPointDependant) {
				EndPointDependantParametersList.push(parameter);
			}
			row.insertCell(cellNum++);
			row.insertCell(cellNum++);

			parameter.row.cells[1].innerHTML = 
			"<input type='string' value='' onchange='modifyParameter()' id='parameter" + parameter.index + "'> "; //Insertion du champ pour rentrer la valeur correspondant à l'option
		
			parameter.row.cells[2].outerHTML = 
			"<td id='interval" + parameter.index + "'>" + infos.comment + 
			(Array.isArray(infos.range) || (infos.unit[lang] != "") ?
			" (" + (Array.isArray(infos.range) ? infos.range[0] + " " + langData.to[lang] + " " + infos.range[1]  : "") +
			infos.unit + ")</td>"
			: "");
			
		break;

		case "hexaArray":
			var infos = { unit: "", comment : "", range: [], EndPointDependant: false  };
			getParameterInfos(parameter,infos );
			parameter.index = parameterIndex;
			if (infos.EndPointDependant) {
				EndPointDependantParametersList.push(parameter);
			}
			row.insertCell(cellNum++);
			row.insertCell(cellNum++);

			parameter.row.cells[1].innerHTML = 
			"<input type='string' value='' onchange='modifyParameter()' id='parameter" + parameter.index + "'> "; //Insertion du champ pour rentrer la valeur correspondant à l'option
		
			parameter.row.cells[2].outerHTML = 
			"<td id='interval" + parameter.index + "'>" + infos.comment + 
			(Array.isArray(infos.range) || (infos.unit[lang] != "") ?
			" (" + (Array.isArray(infos.range) ? infos.range[0] + " " + langData.to[lang] + " " + infos.range[1] : "") +
			infos.unit + ")</td>"
			: "");
			
		break;
		
		
		default:
			var infos = { unit: "", comment : "", range: [], EndPointDependant: false  };
			getParameterInfos(parameter,infos);
			parameter.index = parameterIndex;
			if (infos.EndPointDependant) {
				EndPointDependantParametersList.push(parameter);
			}
			row.insertCell(cellNum++);
			row.insertCell(cellNum++);
			UpdateStdFields(parameter,infos,editable);
			
			
	}
	// If required add a checkbox right indented  
	if (selectable) {
		// If not defined in json, by default a selectable parameter is not selected
		checkedStr = (typeof(parameter.selected) == 'undefined' ? "" : (parameter.selected ? "checked" : "" )); 
		parameter.row.cells[1].innerHTML += "<div style='float: right;'> <input type='checkbox' " + 
			checkedStr + " id='parameterSelect" + parameterIndex + "'>"+ "</div> ";
	}
}
function selectSource(){
	sourceSelecter = document.getElementById("parameter2");
	if(sourceSelecter != null){

		var ourSource = currentProductData.clusters.find(clusters => clusters.clusterID == currentCluster).availablePowerSource;

		var sum = ourSource.length === 1 ?  ourSource[0] :ourSource.reduce(function(a, b){return a + b;}, 0);

		sourceSelecter.options[sum-1].selected = true;
		sourceSelecter.disabled = true;
	}
}
//--------------------------------------------------------------------------------------------------
//	PARTIE 4 : Fonctions utilisées suite à l'édition d'un paramètre
//--------------------------------------------------------------------------------------------------


//Fonction de vérification des données saisies par l'utilisateur
function checkDataValidity(element,parameter) {
	var enteredValue = document.getElementById('parameter' + parameter).value; //On récupère la valeur saisie
	var infos = { unit: "", comment : "", range: [], EndPointDependant: false  };
	getParameterInfos(element,infos );		
	
	if(element.type == "hexa" || element.type == "hexaArray") { //Si le paramètre est une donnée hexadécimal
		document.getElementById('parameter' + parameter).value = isHexByte(enteredValue.trim()) && enteredValue.length < infos.range[1] ? enteredValue.trim() : "";
	}else if ((infos.range !== undefined) && (enteredValue > infos.range[1])) { //Si la valeur est trop élevée
		document.getElementById('parameter' + parameter).value = infos.range[1]; //On la modifie par la valeur maximale
	} else if((infos.range !== undefined) && (enteredValue < infos.range[0])) { //Si la valeur est trop faible
		document.getElementById('parameter' + parameter).value = infos.range[0]; //On la modifie par la valeur minimale
	} else if(element.type == "time") { //Si le paramètre est une donnée de temps
		document.getElementById('parameter' + parameter).value = parseInt(enteredValue); //On l'oblige à être une valeur entière
	} else { //Sinon
		document.getElementById('parameter' + parameter).value = parseInt(enteredValue*(element.mantissa))/(element.mantissa); //On supprime les décimales de trop
	}
}

function isHexByte(str) {
	if(str.length % 2 === 0){
		return /^[A-F0-9]+$/i.test(str)
	}else{
		return false
	}
  }

//Fonction permettant de modifier l'affichage lors d'un changement de type de rapport
function modifyReportType() {
	currentReportType = document.getElementById('reportSelect').value; //On récupère le type de rapport sélectionné
	switchCategory(currentReportType); //On appelle la fonction de changement de commande à nouveau pour réactualiser les options
}


//Fonction appelée lors d'un changement d'unité pour les champs de données temporelles
function switchTimeUnit(parameterIndex) {
	var tdData = document.getElementById('interval' + parameterIndex).innerHTML; //On récupère le contenu de la cellule présentant l'intervalle
	var selectedUnit = document.getElementById('unit' + parameterIndex).value; //On récupère l'unité sélectionnée
	
	if(selectedUnit == "Seconds") { //Si l'unité sélectionnée est "secondes"
		document.getElementById('interval' + parameterIndex).innerHTML = tdData.replace(langData.minutes[lang], langData.seconds[lang]); //On remplace l'unité actuelle par la nouvelle
	} else if(selectedUnit == "Minutes") { //Si l'unité sélectionnée est "minutes"
		document.getElementById('interval' + parameterIndex).innerHTML = tdData.replace(langData.seconds[lang], langData.minutes[lang]); //On remplace l'unité actuelle par la nouvelle
	}
}


//Fonction appelée lors de la modification d'un paramètre par l'utilisateur
function modifyParameter() {
	var i = 0; //Initialisation d'une variable d'index "i"
	currentCommandParameters.forEach(function(element) { //Pour chacun des paramètres
		if(element.editable) { //Si le paramètre est modifiable
			if(element.type == "data" || element.type == "array") {
				element.subParameters.forEach(function(subParameter) {
					if(subParameter.editable) {
						if(subParameter.type != "select") {
							checkDataValidity(subParameter,i); //On demande la vérification du paramètre actuel
						}
						i++; //Incrémentation de la variable "i"
					}
				});
			} else if(element.type != "select") {
				var lelement = element;
				
				currentProductData.clusters.forEach(function(selectedCluster){
					if(selectedCluster.clusterID == currentCluster) {
						lelement.range = (typeof selectedCluster[element.ParameterID + ".range"] !== 'undefined' ? selectedCluster[element.ParameterID + ".range"] : element.range);
					}
				});
												
				checkDataValidity(lelement,i); //On demande la vérification du paramètre actuel
				i++; //Incrémentation de la variable "i"
			} else {
				i++;
			}
		}
	});
}


function checkBatchAvailability(){
	let lBool = false;
  // Following if comes from FOTA LEC
	if(currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].CommandID === "ConfigureReporting"){
		
		currentProductData.clusters.forEach(function(cluster){
			if(cluster.batch != undefined && cluster.clusterID === currentCluster){
				cluster.batch.forEach(function(attributeBatch){
					if(attributeBatch.attribute === currentClusterData.attributes[currentAttributeIndex].AttributeID && !(currentSelectedMode == 0 && attributeBatch.config == undefined)){
						lBool = attributeBatch.available;
					}
				})
			}
		});
		
	}
	return lBool;
}

//--------------------------------------------------------------------------------------------------
//	PARTIE 5 : Fonctions permettant la génération et l'affichage du format .json correspondant
//--------------------------------------------------------------------------------------------------

function isSelectedParam(param,paramIndex) {
	var isSelected=true;
	var paramSelectCheckBox = document.getElementById('parameterSelect' + paramIndex);
	if (paramSelectCheckBox !== null) 
		isSelected = (paramSelectCheckBox.checked);
	return(isSelected);
}

function isEditedParam(param,paramIndex){
	if(!param.editable) return false;
	if(param.type == "select"){
		return document.getElementById("parameter"+paramIndex).selectedIndex == 1 ? true : false;
	}else if (param.type == "number"){
		return document.getElementById("parameter"+paramIndex).value == 0 ? false : true;
	}else if (param.type == "string"){
		return document.getElementById("parameter"+paramIndex).value == "" ? false : true;
	}
	
}
//Fonction permettant de générer les données sous format JSON
function generateJson() {
	var jsonObject = new Object(); //Création d'un objet JavaScript
	
	//Traitement du EndPoint
	var endpoint = document.getElementById("endpointSelect");
	if(endpoint != null) {
		jsonObject.EndPoint = parseInt(endpoint.value);
	} else {
		jsonObject.EndPoint = 0;
	}
	
	//Traitement du type de rapport
	jsonObject.Report = "Standard";
	
	/* if(currentReportType == 0) {
		jsonObject.Report = "Standard";
	} else {
		jsonObject.Report = "Batch";
	} */
	
	//Traitement de la commande choisie
	jsonObject.CommandID = currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].CommandID;
	
	//Traitement du cluster correspondant (et sous produit s'il existe)
	jsonObject.ClusterID = currentCluster;
	//if (typeof(clusterData.subProductID !== 'undefined')) jsonObject.subProductID = currentClusterData.subProductID;
	
	//Traitement de l'attribut concerné
	jsonObject.AttributeID = currentClusterData.attributes[currentAttributeIndex].AttributeID;
	
	//Traitement des paramètres supplémentaires
	if(currentCommandParameters != null && currentReportType == 0) {
		var i = 0;
		currentCommandParameters.forEach(function(element) { //Pour chacun des paramètres de la commande sélectionnée
			if(element.editable) {
				if(element.type == "data") {
					var dataParameter = new Object();
					var tmpTICReportType ="Standard";
					element.subParameters.forEach(function(subParameter) {
						if(subParameter.editable) {
							if (subParameter.ParameterID == "_TICDataSelector_Report") {
								tmpTICReportType = formatParameterData(subParameter,i);
								i++;
							} else 
							if(currentCluster == "Configuration" && currentReportType == 0 && !thresholdAvailable && subParameter.type == "number"){
								if(currentProductData.clusters.find(clusters => clusters.clusterID == currentCluster).availablePowerSource.indexOf(subParameter.fieldIndex) != -1){
									if (isSelectedParam(i))	dataParameter[subParameter.ParameterID] = formatParameterData(subParameter,i);
									i++; //Incrémentation de la variable "i"
								}
							}else{
								if (isSelectedParam(i))	dataParameter[subParameter.ParameterID] = formatParameterData(subParameter,i);
								i++; //Incrémentation de la variable "i"
							}
							
						}else if(subParameter.ParameterID == undefined){
							// On est dans les datas du TIC, je n'ai pas trouve mieux
							const TICReportSelector = {
								BitField: "",
								DescHeader: {
									Obsolete: "No",
									Report: "Standard",
									PresentField: "DescVarBitfield",
									Size: 1
								}
							};
							let TICDataSelector = JSON.parse(JSON.stringify(TICReportSelector));
							dataParameter.TICReportSelector = TICReportSelector;
							dataParameter.TICDataSelector = TICDataSelector;
							dataParameter["TICDataSelector"]["DescHeader"]["Report"] = tmpTICReportType;

							var dataParameterTic = new Object();
							subParameter.forEach(sub => {
								if (sub.selectable || sub.editable) {
									if (isSelectedParam(sub,i) || isEditedParam(sub,i)) {
										dataParameterTic[sub.ParameterID]=new Object();
										dataParameterTic[sub.ParameterID]["IsReported"] = (isSelectedParam(sub,i) ? "Yes" : "No");
										if (isEditedParam(sub,i)) {
											dataParameterTic[sub.ParameterID]["IsCriteria"] = "Yes";
											dataParameterTic[sub.ParameterID]["Value"] = formatParameterData(sub,i);
										} else {
											dataParameterTic[sub.ParameterID]["IsCriteria"] = "No";
										}
									}
									i++;
								}
							});
							
							Object.assign(dataParameter,dataParameterTic);
						} else {
							dataParameter[subParameter.ParameterID] = subParameter.value;
						}
					});
					jsonObject[element.ParameterID] = dataParameter;
				} else if(element.type == "array") {
					jsonObject[element.ParameterID] = new Array();
					element.subParameters.forEach(function(subParameter) {
						if(subParameter.editable) {
							if(subParameter.type === "hexaArray"){
								var hexaArrayData = formatParameterData(subParameter,i);
								hexaArrayData.map(el => jsonObject[element.ParameterID].push(el));
								i++;
							}else{
								if (isSelectedParam(i))	jsonObject[element.ParameterID].push(formatParameterData(subParameter,i));
								i++;
							}

						} else {
							jsonObject[element.ParameterID].push(subParameter.value);
						}
					});
				} else if(element.type == "select") {
					if(currentCommandParameters.find(el => el.ParameterID == "AttributeType") != undefined  && currentCommandParameters.find(el => el.ParameterID == "AttributeType").value ==  "Bitmap16"){
						if (isSelectedParam(i))	jsonObject[element.ParameterID] = formatBitmap(16,0,formatParameterData(element,i));
						i++; //Incrémentation de la variable "i"
					}else if(currentCommandParameters.find(el => el.ParameterID == "AttributeType") != undefined  && currentCommandParameters.find(el => el.ParameterID == "AttributeType").value ==  "Bitmap8"){
						if (isSelectedParam(i))	jsonObject[element.ParameterID] = formatBitmap(8,0,formatParameterData(element,i));
						i++; //Incrémentation de la variable "i"
					}
					else{
						if (isSelectedParam(i))	jsonObject[element.ParameterID] = formatParameterData(element,i);
						i++; //Incrémentation de la variable "i"
					}
					
				}
				else {
					if (isSelectedParam(i))	jsonObject[element.ParameterID] = formatParameterData(element,i);;
					i++; //Incrémentation de la variable "i"
				}
			} else {
				jsonObject[element.ParameterID] = element.value;
			}
		});
	}else if(currentCommandParameters != null && currentReportType == 1){
		var i = 0;
		var Batch = {};
		jsonObject["Batches"] = [];
		currentCommandParameters.forEach(function(element) { //Pour chacun des paramètres de la commande sélectionnée
			if(element.ParameterID === "ReportParameters"){
				jsonObject[element.ParameterID] = element.value;
			}
			else if(element.ParameterID === "Instance"){
				jsonObject[element.ParameterID] = element.value;
			}
			else{
				if(element.editable) {
					if(element.type == "data") {
						var dataParameter = new Object();
						element.subParameters.forEach(function(subParameter) {
							if(subParameter.editable) {
								if (isSelectedParam(i))	dataParameter[subParameter.ParameterID] = formatParameterData(subParameter,i);
								i++; //Incrémentation de la variable "i"
							} else {
								dataParameter[subParameter.ParameterID] = subParameter.value;
							}
						});
						Batch[element.ParameterID] = dataParameter;
					} else if(element.type == "array") {
						Batch[element.ParameterID] = new Array();
						element.subParameters.forEach(function(subParameter) {
							if(subParameter.editable) {
								if (isSelectedParam(i))	Batch[element.ParameterID].push(formatParameterData(subParameter,i));
								i++;
							} else {
								Batch[element.ParameterID].push(subParameter.value);
							}
						});
					} else {
						if (isSelectedParam(i))	Batch[element.ParameterID] = formatParameterData(element,i);;
						i++; //Incrémentation de la variable "i"
					}
				} else {
					Batch[element.ParameterID] = element.value;
				}
		
			}
		});
		jsonObject["Batches"][0] = Batch;
	}
	
	currentProductData.clusters.some(function(cluster){
		if (currentCluster === cluster.clusterID && thresholdAvailable  ){
			fromIhmToJson();
			jsonObject.Cause = [];
			for(var i=0;i<obj.length;i++){
				jsonObject.Cause[i] = obj[i];
			}
		}
	});	
	//Renvoi de la chaîne au format JSON
	return JSON.stringify(jsonObject,null,4);
}


//Fonction déterminant si une chaîne de caractères contient un format JSON
function isJson(item) {
    item = (typeof item !== "string" ? JSON.stringify(item) : item);
    try {
        item = JSON.parse(item);
    } catch (e) {
        return false;
    }
    if (typeof item === "object" && item !== null) {
        return true;
    }
    return false;
}


//Fonction permettant de formater les différents paramètres pour la génération du JSON
function formatParameterData(parameter,parameterIndex) {
	switch(parameter.type) {
		case "time":
			var timeParameter = new Object();
			timeParameter.Value = parseInt(document.getElementById('parameter' + parameterIndex).value);
			timeParameter.Unit = document.getElementById('unit' + parameterIndex).value;
			if(timeParameter.Value == 0 && timeParameter.Unit == "Minutes"){
				timeParameter.Unit = "Seconds";
			}
			return timeParameter;
		break;
		
		case "select":
			var selectedOption = document.getElementById('parameter' + parameterIndex).value;
			if(isJson(selectedOption)) {
				return JSON.parse(selectedOption);
			}else{
				intval = parseInt(selectedOption);
				return (! isNaN(intval) ? intval : selectedOption);
			}
		break;

		case "numberToHexByte":
			var val = document.getElementById('parameter' + parameterIndex).value;
			return (val).toString(16).padStart(2, '0');
		break;

		case "hexa":
			return document.getElementById('parameter' + parameterIndex).value.toString();
		break;

		case "string":
			return document.getElementById('parameter' + parameterIndex).value;
		break;
		
		case "hexaArray":
			var bytes = document.getElementById('parameter' + parameterIndex).value.toString();
			var bytesArray = []
			for(var i = 0; i< bytes.length; i+=2){
				bytesArray.push(bytes.slice(i,i+2))
			}
			bytesArray = bytesArray.map(el => parseInt(el,16))
			bytesArray.unshift(bytesArray.length)


			return bytesArray;
		default:
			theHMIElement=document.getElementById('parameter' + parameterIndex);
			theMantissa=parameter.mantissa;
			theMultiplier=parameter.multiplier;
			if(currentCommandParameters[0].value === "SinglePrecision"){
				return Number(theHMIElement.value);
			}else if(theMantissa > theMultiplier){// assume float expected (for now used in TIC multi fields, wher attribute datatype is ByteString (notSinglePrecision))
				return (Math.round(Number(theHMIElement.value)*(theMantissa))/(theMantissa))*(theMultiplier);
			}else
			{
				return Math.round((parseInt((theHMIElement.value)*(theMantissa))/(theMantissa))*(theMultiplier)*(theMultiplier))/(theMultiplier);
			}
	}
}


//Fonction générant l'affichage du résultat au format JSON
function showFinalJson() {
	clearElement("jsonOutput");
	clearElement("frameOutput");
	var jsonOutput = generateJson();
	var outputLength = jsonOutput.split(/\r\n|\r|\n/).length; //On adapte la hauteur du bloc de sortie
	if((thresholdAvailable && checkTresholdOnExceedOnFall()) || !thresholdAvailable){
		document.getElementById('jsonOutput').innerHTML = "<p><span style='font-size: 16px;'>⑤ </span>" + langData.finalJsonMsg[lang] + "</p><textarea rows='" + outputLength + "' cols='100' style='resize:none' readonly='readonly'>" + jsonOutput + "</textarea>";
	}
}



//--------------------------------------------------------------------------------------------------
//	PARTIE 6 : Fonctions permettant de récupérer et d'afficher la trame correspondante
//--------------------------------------------------------------------------------------------------


//Fonction déterminant le script auquel effectuer la requête pour récupérer la trame
function getEncoderFileLocation(callback) {
	var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState === XMLHttpRequest.DONE) {
			if (callback && typeof callback === 'function') {
				var serverInfo = request.getResponseHeader("server").toLowerCase();
				if(!!~serverInfo.indexOf("php")) {
					callback(getRootUrl() + "/Lora/EncoderAPIs/encoder.php");
				} else if(!!~serverInfo.indexOf("python")) {
					callback(getRootUrl() + "/Lora/EncoderAPIs/encoder.py");
				} else {
					callback(null);
				}
			}
        }
    };
    request.open('HEAD', document.location, true);
    request.send(null);
}


//Fonction permettant la récupération et l'affichage de la trame
function showFinalFrame() {
	clearElement("jsonOutput");
	clearElement("frameOutput");

	var jsonOutput = generateJson();
	if((thresholdAvailable && checkTresholdOnExceedOnFall()) || !thresholdAvailable){
		getEncoderFileLocation(function(scriptLocation) {
			if(scriptLocation != null) {
				jQuery.get(scriptLocation + "?json=" + jsonOutput, function(data, status) {
					if(status == "success" && !(!!~data.indexOf("errorMsg"))) {
            if (loraEncoderType == "LoraEncoderConfiguration") {
						document.getElementById('frameOutput').innerHTML = "<p><span style='font-size: 16px;'>⑤ </span>" + langData.finalFrameMsg[lang] + "</p><textarea rows='1' cols='100' style='resize:none' readonly='readonly'>" + data.trim() + "</textarea>";
            }else{
						document.getElementById('frameOutput').innerHTML = "<p><span style='font-size: 16px;'>⑤ </span>" + langData.finalFrameMsg[lang] + "</p><textarea rows='10' cols='100' style='resize:none' readonly='readonly'>" + data.trim() + "</textarea>";
            }
					} else {
						document.getElementById('frameOutput').innerHTML = "<p><span style='font-size: 16px;'>⑤ </span>" + langData.finalFrameMsg[lang] + "</p><textarea rows='1' cols='100' style='resize:none' readonly='readonly'>" + langData.errorMsg[lang] + "</textarea>";
					}
				});
			} else {
				document.getElementById('frameOutput').innerHTML = "<p><span style='font-size: 16px;'>⑤ </span>" + langData.finalFrameMsg[lang] + "</p><textarea rows='1' cols='100' style='resize:none' disabled>" + langData.errorMsg[lang] + "</textarea>";
			}
		});
	}
	
	
	
}




//Fonction permettant la récupération et l'affichage de la trame pour Fota
function showFinalTxt(checked,aButton){

	if(document.getElementById('parameter0') != null && document.getElementById('parameter0').value === '') return
	
	clearElement("jsonOutput");
	clearElement("frameOutput");

	if(gLocalConfiguration){
		//Affiche le texte 6, le bouton selection du port COM, bouton selection fichier, texte 7 et bouton envoie de configuration
		showLocalBlock();
		// Affiche le tableau pour introduire les fichiers
		showLocalConf();
		fShowFile();
	}
	
	var jsonOutput = generateJson();
	
	rndHex = rndHexValue(4);
	gRandValueConfig = currentDefaultAddresses[1] + addSpace(rndHex) + "\nq";
	rndHexToDec = parseInt("" + rndHex.slice(2,4) +rndHex.slice(0,2),16).toString(10);
	
	document.getElementById('txtNbEight').innerHTML= langData.finalConfButton[lang] + '<b>' + rndHexToDec + '' + '<br/> Mode configuration :</b>';
	document.getElementById("txtNbEight").setAttribute("style","line-height: 32px;");
	if((thresholdAvailable && checkTresholdOnExceedOnFall()) || !thresholdAvailable){

			getEncoderFileLocation(function(scriptLocation) {
				if(scriptLocation != null) {
					jQuery.get(scriptLocation + "?json=" + jsonOutput, function(data, status) {
						
						var copiegDataConcatenation = gDataConcatenation;
						
						gDataConcatenation = gDataConcatenation + (aButton ? twoDigit((data.length/2).toString(16)) + " " + addSpace(data) + "\n" : "");
						gDataConcatenateLength = gDataConcatenateLength + (aButton ?(Number(data.length))/2:0);
						
						// Si on a des trames par defaut alors on calcule leur taille, et on leur ajoute des espaces pour ensuite les ajouter avec le reste des trames
						if(currentDefaultFrame[0] != "0"){
							var currentDefaultFrameConcatenated = "";
							for(element in currentDefaultFrame){
								gDataConcatenateLength += (Number(currentDefaultFrame[element].length))/2;
								currentDefaultFrameConcatenated += twoDigit((currentDefaultFrame[element].length/2).toString(16)) + " " + addSpace(currentDefaultFrame[element]) + "\n";
							}
						}else{
							currentDefaultFrameConcatenated = "";
						}
						
						
						//Vérification de la taille de la trame
						if ((checked? 6:0) + gDataConcatenateLength > 512){
							alert(langData.errorTrame[lang]);
							gDataConcatenation = copiegDataConcatenation;
						}

						//Affichage des trames ou non
						if(status == "success" && !(!!~data.indexOf("errorMsg"))) {
							document.getElementById('txtOutput').innerHTML = "<p><span style='font-size: 16px;'> ⑤ </span>" + langData.finalConfMsg[lang] + "</p><textarea name ='textConf' id='textConfId' rows='5' cols='70' style='resize:none;' readonly='readonly'>" + currentDefaultAddresses[0] + (checked && !gDataConcatenation.startsWith(gDataReset.replace("\n", ''))? gDataReset +"\n" : "") + currentDefaultFrameConcatenated  + gDataConcatenation + gRandValueConfig + "</textarea>";
						}
						else {
							document.getElementById('txtOutput').innerHTML = "<p><span style='font-size: 16px;'>⑤ </span>" + langData.finalConfMsg[lang] + "</p><textarea rows='1' cols='100' style='resize:none' readonly='readonly'>" + langData.errorMsg[lang] + "</textarea>";
						}

						// Affichage d'un bloc de texte et d'un bouton pour sauvegarder sa configuration
						if(gLocalConfiguration && document.getElementById("nameFileId") == undefined){
										document.getElementById('outputContainer').style.position = "relative";
										var nameFile = document.createElement("input");
										nameFile.id="nameFileId";
										nameFile.type = "text";

										var labelNameFile = document.createElement("label");
										labelNameFile.htmlFor = nameFile;
										labelNameFile.textContent = langData.finalTxtMessLabelInput[lang];
										document.getElementById("outputContainer").appendChild(labelNameFile);
										document.getElementById("outputContainer").appendChild(nameFile); 

										var fileBlob = new Blob([document.getElementById('textConfId').value], {type: "application/octet-binary"});

										var downloadFile = document.createElement("a");
										downloadFile.id ="downloadFileId";
										downloadFile.setAttribute("href", URL.createObjectURL(fileBlob));
										downloadFile.setAttribute("download", "C0.0.0.0_" + currentEmbeddedName +"." + rndHexToDec + (nameFile.value == "" ? "" : "." + nameFile.value) +".txt");
										downloadFile.appendChild(document.createTextNode(langData.finalTxtMessDownload[lang]));
										downloadFile.style.marginLeft ="5%";

										nameFile.onchange = function() {downloadFile.setAttribute("download", "C0.0.0.0_" + currentEmbeddedName +"." + rndHexToDec + (nameFile.value == "" ? "" + "" : "." + nameFile.value) +".txt")};

										document.getElementById("outputContainer").appendChild(downloadFile);

										

									}else{
										fileBlob = new Blob([document.getElementById('textConfId').value], {type: "application/octet-binary"})
										document.getElementById("downloadFileId").setAttribute("href", URL.createObjectURL(fileBlob));
									}
					}
					);
				}
				}
				);
		}
}


// Fonction qui clear les trames
function resetShowFinalTxt(checked){
	gDataConcatenation="";
	gDataConcatenateLength = Number(gDataConcatenation.length);
	showFinalTxt(checked,false);
}



function loadFile(files){

	if (files.length == 0) return; 
    /* If any further modifications have to be made on the 
       Extracted text. The text can be accessed using the  
       file variable. But since this is const, it is a read  
       only variable, hence immutable. To make any changes,  
       changing const to var, here and In the reader.onload  
       function would be advisible */
	gDataConcatenation = "";   
	const file = files[0]; 
	var fileName;
	if (file.name.includes("_") && file.name.split("_")[1].includes(".")){
		fileName = (file.name.split("_")[1]).split(".")[0];
		
	}else{
		document.getElementById("selectFile").value = null;
		alert(langData.errorLoadConf[lang]);
		return;
	}
	if(fileName == currentEmbeddedName){
		var reader = new FileReader();  
		reader.onload = function(e) {   
			const file = e.target.result; 
	
			// This is a regular expression to identify carriage  
			// Returns and line breaks 
			const lines = file.split(/\r\n|\n/);
			
			document.getElementById('txtOutput').innerHTML = "<p><span style='font-size: 16px;'> ⑤ </span>" + langData.finalConfMsg[lang] + "</p><textarea name ='textConf' id='textConfId' rows='5' cols='70' style='resize:none;' readonly='readonly'>" + lines.join('\n') + "</textarea>";
			if(currentDefaultFrame[0] == "0"){
				var startIndex = lines.indexOf(currentDefaultAddresses[0].slice(0,currentDefaultAddresses[0].length-1))+1;
				var lastIndex = lines.indexOf(currentDefaultAddresses[1].slice(0,currentDefaultAddresses[0].length-1));
				for(var i=startIndex ; i<lastIndex ; i++){
					gDataConcatenation += lines[i] + "\n"; 
				}
				rndHex = lines[lastIndex+1].replace(" ","");
				gRandValueConfig = currentDefaultAddresses[1] + addSpace(rndHex) + "\nq";
				rndHexToDec = parseInt("" + rndHex.slice(2,4) +rndHex.slice(0,2),16).toString(10);
			}else{
				var startIndex = lines.indexOf(currentDefaultAddresses[0].slice(0,currentDefaultAddresses[0].length-1))+1 + currentDefaultFrame.length;
				var lastIndex = lines.indexOf(currentDefaultAddresses[1].slice(0,currentDefaultAddresses[0].length-1));
				for(var i=startIndex ; i<lastIndex ; i++){
					gDataConcatenation += lines[i] + "\n"; 
				}
				rndHex =lines[lastIndex+1].replace(" ","");
				gRandValueConfig = currentDefaultAddresses[1] + addSpace(rndHex) + "\nq";
				rndHexToDec = parseInt("" + rndHex.slice(2,4) +rndHex.slice(0,2),16).toString(10);
			}
			document.getElementById('txtNbEight').innerHTML= langData.finalConfButton[lang] + '<b>' + rndHexToDec + '' + '<br/> Mode configuration :</b>';
			document.getElementById("txtNbEight").setAttribute("style","line-height: 32px;");

			document.getElementById("switchLabel").setAttribute("style","display: inline-block");
			gFileLoaded = true;
		}

		reader.onerror = (e) => alert(e.target.error.name);  

		reader.readAsText(file);
	}else{
		document.getElementById("selectFile").value = null;
		alert(langData.errorLoadConf[lang]);
		document.getElementById("switchLabel").setAttribute("style","display: none");
		gFileLoaded = false;
	}
	
}


//--------------------------------------------------------------------------------------------------
//	PARTIE 8 : Fonctions permettant la configuration du port COM et du choix du fichier à envoyer
//--------------------------------------------------------------------------------------------------


function fSelectCom(){
	
	
	// On créé on bouton select pour choisir le port COM
    var selectCom = document.createElement("SELECT");
	selectCom.setAttribute('id', 'selectCom');
	selectCom.setAttribute('style','display:none;margin-left:10%;');
	selectCom.onclick = function(){
		selectedCom = selectCom.options[selectCom.selectedIndex].value;
		postCom();
	}
	selectCom.onchange = function(){
		selectedCom = selectCom.options[selectCom.selectedIndex].value;
		postCom();
	}
	document.getElementById("localSetupCom").appendChild(selectCom);
	var x = document.getElementById("selectCom");
	while(x.length > 0) {
		x.remove(x.length-1);
	}
	var availableCom;
	//$.get("https://localhost:56700/System.txt",function(data){
	$.get("http://localhost:56700/System.txt",function(data){
		availableCom = data;
		data = data.replace(/\n|\r/g,'');
		data = data.split("=")[1];
		data = data.split(";");
		for (i = 0; i < data.length; i++) {
			var newCom = document.createElement("OPTION");
			newCom.setAttribute('id',data[i]);
			newCom.text = data[i];
			newCom.value = data[i];
			document.getElementById("selectCom").appendChild(newCom);

	}
	
	},"text");
	selectCom.onfocus = function(){
		
		//$.get("https://localhost:56700/System.txt",function(data){
		$.get("http://localhost:56700/System.txt",function(data){
		if(availableCom != data){
			availableCom = data;
			while(selectCom.options.length > 0){selectCom.remove(0);}
			data = data.replace(/\n|\r/g,'');
			data = data.split("=")[1];
			data = data.split(";");
			for (i = 0; i < data.length; i++) {
				var newCom = document.createElement("OPTION");
				newCom.setAttribute('id',data[i]);
				newCom.text = data[i];
				newCom.value = data[i];
				selectCom.appendChild(newCom);
		}
		};
	},"text")
	}	
}


function fSelectFile(){
	// On créé on bouton selectfile pour choisir un fichier à importer, ou le créer
	var selectFile = document.createElement("INPUT");
	selectFile.setAttribute("id", "selectFileId");
	selectFile.setAttribute("type", "file");
	selectFile.setAttribute("accept", ".txt,.wttc");
	selectFile.setAttribute('style','display:none;margin-bottom: 2%;margin-left:1%;');
	selectFile.onchange = function() { fShow(selectFile); };

	var textBetween = document.createElement('div')
	textBetween.setAttribute("id", "selectFileTextId");
	textBetween.setAttribute('style','display:none; margin-top: 10px;');
	textBetween.innerHTML = langData.or[lang]

	var createFileModal = document.createElement("INPUT");
	createFileModal.setAttribute("id", "customFile");
	createFileModal.setAttribute("type", "button");
	createFileModal.setAttribute('style','display:none;');
	createFileModal.value = langData.customFile[lang];

	// Get the modal
	var modal = document.getElementById("myModal");

	// Get the <span> element that closes the modal
	var span = document.getElementsByClassName("close")[0];

	// When the user clicks on the button, open the modal
	createFileModal.onclick = function() {
		modal.style.display = "block";
		displayCustomDeviceList();
		gDeviceTempListCustom = [...gDeviceListCustom]

		document.getElementById('createFile').disabled = (gDeviceTempListCustom.length === 0);

	}

	// When the user clicks on <span> (x), close the modal
	span.onclick = function() {
		modal.style.display = "none";
	}

	// When the user clicks anywhere outside of the modal, close it
	window.onclick = function(event) {
		if (event.target == modal) {
			modal.style.display = "none";
		}
	}

	fModalFunction()
	
	document.getElementById("localSetupDownload").appendChild(selectFile);
	document.getElementById("localSetupDownload").appendChild(textBetween);
	document.getElementById("localSetupDownload").appendChild(createFileModal);
}

function checkInput(event){
	let target = event.target
	
	const regex = new RegExp(target.minLength === 16 ? /\b[0-9A-F]{16}\b/gi : /\b[0-9A-F]{32}\b/gi)
	
	if(!regex.test(target.value)){
		document.getElementById(target.id).style.color = 'red'
		gDeviceInputCorrect[target.id] = false
	}else {
		document.getElementById(target.id).style.color = 'black'
		gDeviceInputCorrect[target.id] = true
	}

	for(let [key, value] of Object.entries(gDeviceInputCorrect)){
		if(!value){
			document.getElementById('createDevice').disabled = true
			return
		}
	}
	document.getElementById('createDevice').disabled = false
}

function fModalFunction(){
	var createDeviceButton = document.getElementById('createDevice')
	createDeviceButton.value = langData.addDevice[lang]
	createDeviceButton.addEventListener("click", (event) => {
		event.preventDefault()
		addDeviceInTempList()
		document.querySelector('form').reset()
	});

	var createFile = document.getElementById('createFile')
	createFile.value = langData.createFile[lang]
	createFile.addEventListener('click', () => {
		addDeviceInList()
		fShowFileCreated()
		document.getElementById("myModal").style.display = 'none'
	})  
}

function addDeviceInList(){
	gDeviceListCustom = [...gDeviceTempListCustom]
}

function addDeviceInTempList(){
	const formData = new FormData(document.querySelector('form'))
	var newDevice = {}
	for (var pair of formData.entries()) {
		newDevice[pair[0]] = pair[1]
	}

	gDeviceTempListCustom.push(newDevice)
	addRowInModal(newDevice)
	document.getElementById('createFile').disabled = false
	document.getElementById('createDevice').disabled = true
	gDeviceInputCorrect = {'addDevEUI' : false, 'addNwkSKeyABP' : false, 'addAppSKeyABP' : false, 'addAppKey' : false};
}

function addDeviceInListFromSelect(){
	let listUnformattedDevice = gDeviceList.split('\n');

	listUnformattedDevice.forEach(device => {
		if(device.length > 1){
			let temp = device.split(';')
			gDeviceListCustom.push({
				'DevEUI' : temp[0],
				'ABP_NwkSKey' : temp[2],
				'ABP_AppSKey' : temp[3],
				'OTA_AppKey' : temp[6]
			})
		}
	})

}

function deleteDeviceInList(deveui){
	let indexToRemove = gDeviceTempListCustom.findIndex(device => {
		return device['DevEUI'] === deveui
	})

	gDeviceTempListCustom.splice(indexToRemove, 1)

	if(gDeviceTempListCustom.length === 0) document.getElementById('createFile').disabled = true
	document.getElementById('createDevice').disabled = true
}

function displayCustomDeviceList(){
	// Clear the device list before populate it
	var table = document.getElementById('modalTableBody')
	for(row of table.children){
		table.deleteRow(0)
	}

	gDeviceListCustom.forEach(device => {
		addRowInModal(device);
	})
}

function addRowInModal(device){

	//Check if device not already in the table
	var table = document.getElementById('modalTableBody')

	
	for(row of table.children){
		if(row.cells[0].innerHTML === device['DevEUI']) return
	}




	var row = table.insertRow(0);
	var cell1 = row.insertCell(0);
	var cell2 = row.insertCell(1);
	cell1.innerHTML = device['DevEUI'];
	cell2.innerHTML = 'x';

	cell2.addEventListener("mouseover", function (event) {
		event.target.style.color = 'red'
	}, false);
	cell2.addEventListener("mouseout", function (event) {
		event.target.style.color = "black";
	}, false);

	cell2.onclick = (event) => {
		table.deleteRow(event.target.parentNode.rowIndex-1);
		deleteDeviceInList(cell1.textContent)
	}
}

function createdFileFormatted(){
	let result = "DevEUI;ABP_DevAddr;ABP_NwkSKey;ABP_AppSKey;CodeFamille;Version;OTA_AppKey;OTA_AppEUI;Unconfirmed;CodeFamillePF;Synchro;Adr;SN;NumBL;NumCde;DevEUI2\n"
	gDeviceListCustom.forEach((value) => {
		result+=`${value['DevEUI']};;${value['ABP_NwkSKey']};${value['ABP_AppSKey']};;;${value['OTA_AppKey']};;;;;;;;;\n`
	})
	return result
}


//

function confButton(){

	var switchLabel = document.createElement("LABEL");
	switchLabel.setAttribute("class", "switch");
	switchLabel.setAttribute("id","switchLabel")

	// On créé un bouton pour envoyer la configuration
	var postButton = document.createElement("INPUT");
	postButton.setAttribute("type", "checkbox");
	postButton.setAttribute("id", "postButton");
	postButton.setAttribute("style","float:left;margin-bottom: 2%;display:none;");
	postButton.setAttribute('style','');
	postButton.onclick = function() { postHTML(); };
	
	
	var switchSlider = document.createElement("SPAN");
	switchSlider.setAttribute("class", "slider round")

	switchLabel.appendChild(postButton)
	switchLabel.appendChild(switchSlider)

	document.getElementById("localSetupButton").appendChild(switchLabel);

	var postButtonResult = document.createElement("div");
	postButtonResult.setAttribute('id','postButtonResultId');
	postButtonResult.setAttribute('style','display:none;');
	document.getElementById("localSetupButton").appendChild(postButtonResult);
	
}


// On affiche les boutons et du texte après demande du text
function showLocalBlock(){
	document.getElementById("txtNbSix").setAttribute("style","display:block;");
	document.getElementById("selectCom").setAttribute("style","display:block;");
	document.getElementById("selectFileId").setAttribute("style","display:block;");
	document.getElementById("selectFileTextId").setAttribute("style","display:block;margin-top: 15px;");
	document.getElementById("txtNbSeven").setAttribute("style","display:block;");
	document.getElementById("customFile").setAttribute("style","display:block; margin: 2% 0;");
	document.getElementById("switchLabel").setAttribute("style","display:inline-block;");
	document.getElementById("postButtonResultId").setAttribute("style","display:block;");
	document.getElementById("txtNbEight").setAttribute("style","display:block;");
}


function showLocalConf(){
	
	// On créé un tableau pour ensuite insérer les selected file
	document.getElementById('localSetupTable').innerHTML = "<table id='generateTable' style = 'float:top-left;' class='tablepress tablepress-id-11'></table>";
	var generateTable = document.getElementById('generateTable');
	
	var header = generateTable.createTHead();
	
	var row = header.insertRow(0);
	row.insertCell(0).outerHTML = "<th>" + langData.name[lang] + "</th>";
	
	var body = generateTable.createTBody();
	body.setAttribute("id", "bodyFile");
	
    }


// Fonction qui lit les listeproduits et les ajoutes dans un "input type=text" pour pouvoir les envoyer   
function fReadAllFile(){
	
	selectFile = document.getElementById('selectFileId').files;

	let start = "DevEUI;ABP_DevAddr;ABP_NwkSKey;ABP_AppSKey;CodeFamille;Version;OTA_AppKey;OTA_AppEUI;Unconfirmed;CodeFamillePF;Synchro;Adr"
	var gDeviceListTemp = [];
	//On va lire un document et concaténer le contenu dans une variable gDeviceList qui est globale  
	function setupReader(file) {
		// C'est une fonction asynchrone
		var reader = new FileReader();
		gDeviceListName = file.name;
		
		// Check if gDeviceListName is correctly formatted for the LoraUpdater
		let result = [...gDeviceListName.matchAll(/[_]/g)].map(a => a.index);

		let firstCondition = gDeviceListName.startsWith("ListeProduits_"); // Must start with ListeProduits_
		let secondCondition = !isNaN(gDeviceListName.slice(result[0]+1,result[1])); // Must be followed by numbers
		
		if(!(firstCondition && secondCondition)){
			gDeviceListName = "ListeProduits_" + Math.floor(Math.random() * 10000) +"_" + gDeviceListName;
		}
		reader.onload = function(e) {   
			var text = e.target.result;
			gDeviceListTemp = text.split("\n").slice(1).join("\n");
			gDeviceList =  gDeviceListTemp;

			addDeviceInListFromSelect()
		}

		reader.readAsText(file, "UTF-8");
		
	}
	//Pour chaque document inseré on va appeler la fonction ci-dessous
	for (var i = 0; i < selectFile.length; i++) {
		setupReader(selectFile[i]);
	}

}

// On enlève l'entête des listes produits et on remplace les \r\n par des caractères uniques, ici ce sont des @
function filtreResult(str){
 str = str.replace(/(?:\\[rn]|[\r\n])/g,"@");	
 return str;
}


// On affiche les fichiers sélectionnés dans un tableau
function fShow(selectFile) {
	
	clearElement('bodyFile');
	clearElement('selectFileId');
	
	fReadAllFile();
	
	body = document.getElementById("bodyFile");
	
	fShowFile();
}

var fileFormat;

function fShowFile() {
	
	clearElement('bodyFile');
	clearElement('selectFileId');
	
	fileFormat = [];

	var selectFile = document.getElementById("selectFileId");
	body = document.getElementById("bodyFile");
	for (var i = 0; i < selectFile.files.length; i++) {
		row = body.insertRow(i);
		row.insertCell(0).innerHTML = "<span>" + selectFile.files[i].name + "</span>";
		fileFormat.push(selectFile.files[i].name.substring(selectFile.files[i].name.indexOf(".")+1));
	}
}

function fShowFileCreated() {
	
	clearElement('bodyFile');
	clearElement('selectFileId');
	
	fileFormat = [];

	
	body = document.getElementById("bodyFile");
	row = body.insertRow(0);
	row.insertCell(0).innerHTML = "<span>" + 'Custom_device_list.txt' + "</span>";
}
//----------------------------------------------------------------------------------------------------------------------
//	PARTIE 9 : Fonctions permettant la récupération du fichier DeviceList et l'affichage de ses données dans un tableau
//----------------------------------------------------------------------------------------------------------------------

var scannedDevice = new Map();

function callGetTXT(){
	let xhr = new XMLHttpRequest();

	xhr.open('GET', 'http://localhost:56700/DeviceList.txt');
	//xhr.open('GET', 'https://localhost:56700/DeviceList.txt');
	xhr.responseType = 'text';
	xhr.send();
	xhr.onload = function() {
		let responseObj = xhr.response;
		displayDeviceArray(responseObj);
	};	
}

function displayDeviceArray(fullTxt){
	
	var txt = fullTxt; // On récupère le contenu de la réponse get 
	var l = txt.split('\r\n'); // On la sépare en ligne pour traiter chaque appareil
	
	document.getElementById('localSetupTableByGet').innerHTML = "<table class='tablepress' id='tableau'></table>"; // On modofie le code HTML pour intégrer un tableau vierge
	var tableau = document.getElementById('tableau');
	var caption = tableau.createCaption();
	caption.innerHTML = "<p style='font-size: 16px; float:left;'>⑨ <span style='font-size: 16px;'>" + langData.getDeviceList[lang] + "</span></p>";
	var header = tableau.createTHead(); // On partitionne le tableau en 2 parties, le header et le body
	
	var ligne = header.insertRow(0); //On insère une ligne
	ligne.insertCell(0).outerHTML = "<th> Time </th>"; //Contenu de la première cellule 
	/* ligne.insertCell(1).outerHTML = "<th> Update </th>"; //Contenu de la seconde cellule */ 
	ligne.insertCell(1).outerHTML = "<th> Type </th>"; //Contenu de la troisième cellule 
	ligne.insertCell(2).outerHTML = "<th> Address </th>"; //Contenu de la quatrième cellule
	ligne.insertCell(3).outerHTML = "<th> Major </th>"; //Contenu de la cinquième cellule
	ligne.insertCell(4).outerHTML = "<th> Minor </th>"; //Contenu de la sixième cellule
	ligne.insertCell(5).outerHTML = "<th> Corrective </th>"; //Contenu de la septième cellule
	ligne.insertCell(6).outerHTML = "<th> Build </th>"; //Contenu de la huitaine cellule
	ligne.insertCell(7).outerHTML = "<th> Configuration </th>"; //Contenu de la neuvième cellule
	
	var body = tableau.createTBody(); 
	for (var i = 0; i < l.length-1; i++) {
		ligne = body.insertRow(i);
		var infos = l[i].split(';'); // On sépare la ligne de notre appareil en mot pour les insérer un par un dans le tableau
		infos.splice(1,1);

		var color = 'white';

		const wasInList = scannedDevice.hasOwnProperty(infos[2])
		const isSameAsCurrentConfig = infos[7] === rndHexToDec
		const wasSameAsSavedConfig = wasInList ? scannedDevice[infos[2]]["config"] === infos[7] : false

		if(rndHexToDec === 0){
			color = 'white' // White
		}else{
			if (Object.keys(scannedDevice).length != 0 && wasInList){
				if(wasSameAsSavedConfig && isSameAsCurrentConfig){
					color = "#A4D8A1" // Green
				}else if(isSameAsCurrentConfig){
					color = "#2FDC26" // Green flashy
				}else{
					color = "white" // White
				}
			}else{
				if(isSameAsCurrentConfig){
					color = "#2FDC26" // Green flashy
				}else{
					color = 'white'
				}
			}
		}
		for (var j = 0; j < infos.length; j++){
			ligne.insertCell(j).innerHTML = "<span>" + infos[j] + "</span>";
			ligne.setAttribute('style','background-color:'+ color+';');
		}
		scannedDevice[infos[2]] = {"config" : infos[7]};
	}
}



//--------------------------------------------------------------------------------------------------
//	PARTIE 10 : Gestion des threshold
//--------------------------------------------------------------------------------------------------



// Toutes les variables globales pour le treshold
var thresholdAvailable = false;
var thresholdSlotAvailable;
var thresholdWithAction = false;
var obj= [];
// Objet sous forme de json avec la forme générale que chaque trehsold doit avoir dans le json finale 
var threshObj;

//Liste contenant les différents slots sous forme d'objet
var allThreshold = [];

//Liste contenant les indexs des slots disponibles
var slotAvailable=[];

//List contenant les différent filedIndex du fichier Configuration.json
var fieldIndex = [];
var fieldIndexName = [];
var fieldRange = [];
var fieldUnit = [];
var currentAttributeType = '';
var currentAttributeName = '';
var dynamicButtonCase = [];
var currentMode = 0;








function getThreshold(currentCluster,body){
	
	// Si on est sur un report Standard on peut continuer
	if(currentReportType == 0){
		//On cherche le cluster actuel de notre produit dans le 50-70_etc_.json
		var currentProductDataCluster = currentProductData.clusters.find(cluster => cluster.clusterID == currentCluster.clusterID);
		

		var currentSlot = currentProductDataCluster.threshold.slot != undefined ? currentProductDataCluster.threshold.slot.find( slot => slot.attribute == currentCluster.attributes[currentAttributeIndex].AttributeID) : undefined;
			
		//Si sa commandeID est bien configurereporting et si dans le fichier 50-70_etc_.json pour ce cluster on a rensigné que c'était un treshold alors on continue
		if (currentSlot != undefined && (currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].CommandID === "ConfigureReporting" && currentProductDataCluster.threshold.available === true)){
			thresholdAvailable = true;
			
			// Ces variables sont utile par la suite
			currentAttributeType = currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[0].value;
			currentAttributeName = currentCluster.attributes[currentAttributeIndex].AttributeID;
			var currentTreshold = currentProductDataCluster.threshold.slot.find(threshold => threshold.attribute == currentAttributeName);
			thresholdSlotAvailable = currentTreshold.numberSlot;
			
			// Cette variable servira a actualisé directement l'index des seuils
			for (var j = 0 ; j<thresholdSlotAvailable ; j++){
				slotAvailable[j]=j;
			}
			fieldIndex = [];
			fieldIndexName = [];
			fieldRange = [];
			fieldUnit = [];
			// Si c'est un bytestring alors on aura des histoires de fieldindex et de source à gérer
			if(currentAttributeType === 'ByteString'){
				fieldIndex = [];
				fieldIndexName = [];
				fieldRange = [];
				fieldUnit = [];
				
				var lFieldIndex = ((currentTreshold.fieldindex).sort()).slice(0,((currentTreshold.fieldindex).sort()).length);
				if (!(lFieldIndex.length == 1 && lFieldIndex[0] == 0)){
					fieldIndex = lFieldIndex.slice(0,lFieldIndex.length);
					while(lFieldIndex.length >0){
						var l = currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].subParameters.find(subParameter => lFieldIndex.includes(subParameter.fieldIndex))
						fieldIndexName.push(l.ParameterID);
						
						if(currentCustomData != null){

							// "Data.unit"
							if(currentCustomData["Data.unit"] != undefined){
								fieldUnit.push(currentCustomData["Data.unit"])
								for(el in fieldUnit){
									fieldUnit[el] = fieldUnit[el];
								}
							}else{
								fieldUnit.push(l.ParameterID+"="+l.unit);
							}

							// "Data.range"
							if(currentCustomData["Data.range"] != undefined){
								fieldRange.push(currentCustomData["Data.range"])
								for(el in fieldRange){
									fieldRange[el] = fieldIndexName+"="+fieldRange[el]
								}
							}else{
								fieldRange.push(l.ParameterID+"="+l.range);
							} 

							lFieldIndex.shift();
						}else{

							// "Data.unit"
							if(currentProductDataCluster["Data.unit"] != undefined){
								fieldUnit.push(currentProductDataCluster["Data.unit"])
								for(el in fieldUnit){
									fieldUnit[el] = fieldUnit[el];
								}
							}else{
								fieldUnit.push(l.ParameterID+"="+l.unit);
							}

							// "Data.range"
							if(currentProductDataCluster["Data.range"] != undefined){
								fieldRange.push(currentProductDataCluster["Data.range"])
								for(el in fieldRange){
									fieldRange[el] = fieldIndexName+"="+fieldRange[el]
								}
							}else{
								fieldRange.push(l.ParameterID+"="+l.range);
							} 

							lFieldIndex.shift();
						}
						
					}				
				}
			}else{

				if(currentCustomData != null){

					// "Data.range"
					if(currentCustomData["Data.range"] != undefined){
						fieldRange.push(currentCustomData["Data.range"])
						for(el in fieldRange){
							fieldRange[el] = "Data="+fieldRange[el]
						}
					}else{
						fieldRange.push("Data="+currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].range);
					}

					// "Data.unit"
					if(currentCustomData["Data.unit"] != undefined){
						fieldUnit.push(currentCustomData["Data.unit"])
					}else{
						fieldUnit.push(currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].unit);
					}
					
					currentMultiplier = currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].multiplier;
				

				}else{
					// "Data.range"
					if(currentProductDataCluster["Data.range"] != undefined){
						fieldRange.push(currentProductDataCluster["Data.range"])
						for(el in currentProductDataCluster["endpoints"]){
							fieldRange[el] = "Data="+fieldRange[el]
						}
					}else{
						fieldRange.push("Data="+currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].range);
					}

					// "Data.unit"
					if(currentProductDataCluster["Data.unit"] != undefined){
						fieldUnit.push(currentProductDataCluster["Data.unit"])
					}else{
						fieldUnit.push(currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].unit);
					}
					
					currentMultiplier = currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].multiplier;
				}
				
				
			}
			
			// On setup le ReportParameters pour être en seuil
			if (currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].CommandID === "ConfigureReporting"){
				currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].editable = false;
				currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].value = null;
				currentCluster.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[1].value.New = "Yes";
				setThreshObj();
			}
		}else{
			thresholdAvailable=false;
		}
	}else{
		thresholdAvailable=false;
	}
}
function checkTresholdOnExceedOnFall(){
	var lObj = JSON.parse(JSON.stringify(allThreshold));
	for(var i=0;i<allThreshold.length;i++){
		if(!lObj[i]["On exceed"] && !lObj[i]["On fall"]){
			alert(langData.onCheck[lang]);
			return false;
		}
	}
	return true;

}


function addParameterThresh(body) {
	
	// Séparateur entre les différents slot
	var row = body.insertRow(-1);
	row.insertCell(0).style.backgroundColor = "#ffe3c4";
	row.insertCell(1).style.backgroundColor = "#ffe3c4";
	row.insertCell(2).style.backgroundColor = "#ffe3c4";
	
	//Le select Cause request
	var row = body.insertRow(-1);
	row.insertCell(0).innerHTML=  langData.causeRequest[lang];
	var selectCauseReq = document.createElement('select'); 
	
	var option = document.createElement("option");
	option.text = langData.noCause[lang];
	option.value = "No";
	selectCauseReq.add(option);
	
	option = document.createElement("option");
	option.text = langData.shortCause[lang];
	option.value = "Short";
	selectCauseReq.add(option);
	
	option = document.createElement("option");
	option.text = langData.longCause[lang];
	option.value = "Long";
	selectCauseReq.add(option);
	
	selectCauseReq.setAttribute('id','causeReq');
	
	selectCauseReq.onchange = function(){	
		currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[1].value.CauseRequest = selectCauseReq.value;
	
	};
	row.insertCell(1).appendChild(selectCauseReq);
	row.insertCell(2).innerHTML = langData["causeRequestCom"][lang];
	

	
	//La checkbox secured
	var row = body.insertRow(-1);
	row.insertCell(0).innerHTML= langData.secured[lang];
	var checkboxSecured = document.createElement('input'); 

	checkboxSecured.type = "checkbox"; 
	checkboxSecured.onclick = function(){
		checkboxSecured.checked ? currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[1].value.Secured = "Yes" : currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[1].value.Secured = "No";
	};
	currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[1].value.Secured = "No";
	row.insertCell(1).appendChild(checkboxSecured);
	row.insertCell(2).innerHTML = langData["securedCom"][lang];
	

	
	//La checkbox secured if
	var row = body.insertRow(-1);
	row.insertCell(0).innerHTML= langData.securedIfAlarm[lang];
	var checkboxSecuredIfAlarm = document.createElement('input'); 

	checkboxSecuredIfAlarm.type = "checkbox"; 
	checkboxSecuredIfAlarm.onclick = function(){
		checkboxSecuredIfAlarm.checked ? currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[1].value.SecuredIfAlarm = "Yes" : currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[1].value.SecuredIfAlarm = "No";
	};
	currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[1].value.SecuredIfAlarm = "No";
	row.insertCell(1).appendChild(checkboxSecuredIfAlarm);
	row.insertCell(2).innerHTML = langData["securedIfAlarmCom"][lang];
	
	
	var row = body.insertRow(-1);
	row.insertCell(0).innerHTML = langData.addSlot[lang];
	row.id = "stopHere";
	// Un bouton pour rajouter des indexs
	var newCell = row.insertCell(1);
	var addButton = document.createElement('button');
	addButton.id = 'firstAddButton';
	addButton.innerHTML = langData.add[lang];
	addButton.onclick = function(){
		addAThresh(body);
		addButton.disabled = true;
	};
	newCell.appendChild(addButton);
	row.insertCell(2).innerHTML = langData["addSlotCom"][lang];
			
}





function setThresh(body){
	
	for (var j = 0; j < allThreshold.length; j++) {
		if (currentAttributeType === 'ByteString'){
			allThreshold[j].Source = fieldIndexName.slice(0,fieldIndexName.length);
			if(allThreshold[j]["selectedSource"] === undefined) allThreshold[j]["selectedSource"] = 0;
		}
		// Séparateur entre les différents slot
		var separateRow = body.insertRow(-1);	
		separateRow.insertCell(0).style.backgroundColor = "#ffe3c4";
		separateRow.insertCell(1).style.backgroundColor = "#ffe3c4";
		
		//Un bouton pour supprimer des indexs
		var newCell = separateRow.insertCell(2);
		var deleteButton = document.createElement('button');
		deleteButton.innerHTML = langData.del[lang];
		deleteButton.id = j;
		deleteButton.onclick = function(){
			deleteAThresh(body,this.id);
		};
		newCell.appendChild(deleteButton);
		newCell.style.backgroundColor = "#ffe3c4";
		
		for (const property in allThreshold[j]) {
			
			if( property.search("Selected") === -1 && property.search("selected") === -1){
				propertyName = beautify(property);
				switch (typeof allThreshold[j][property]) {
					case 'number':
					
						var row = body.insertRow(-1);
						row.id = "row_" +property+"_"+j;
						row.insertCell(0).innerHTML= langData[propertyName][lang];
						var input = document.createElement('input'); 
						input.type = "number";
						input.min = 0;
						input.max =255;
						
						if(currentAttributeType != "ByteString"){
							input.step = 1/currentClusterData.attributes[currentAttributeIndex].commands[currentCommandIndex].ReportType[0].parameters[4].mantissa;
						}
						input.value =Number(allThreshold[j][property]);
						input.id = property+"_"+j;
						input.name = property;
						
						var inputText = document.createElement("div");
						inputText.id = "text" + "_" + property + "_" + j;
						inputText.style.display = "inline-block";
						if(currentAttributeType == "ByteString"){
							inputText.textContent = (fieldUnit[allThreshold[j]["selectedSource"]]).split(",")[lang]
						}else{
							inputText.textContent = (fieldUnit[0][document.getElementById("endpointSelect").selectedIndex])[lang];
							document.getElementById("endpointSelect").onchange = function(){
								for (var slot = 0; slot < allThreshold.length; slot++){
									document.getElementById("text_Gap_"+slot).textContent = (fieldUnit[0][document.getElementById("endpointSelect").selectedIndex])[lang];
									document.getElementById("text_Value_"+slot).textContent = (fieldUnit[0][document.getElementById("endpointSelect").selectedIndex])[lang];
									document.getElementById("Value_"+slot).min = Number(fieldRange[0].split("=")[1].split(",")[document.getElementById("endpointSelect").value*2]);
									document.getElementById("Value_"+slot).max = Number(fieldRange[0].split("=")[1].split(",")[document.getElementById("endpointSelect").value*2+1]);
									document.getElementById("Gap_"+slot).min = Number(fieldRange[0].split("=")[1].split(",")[document.getElementById("endpointSelect").value*2]);
									document.getElementById("Gap_"+slot).max = Number(fieldRange[0].split("=")[1].split(",")[document.getElementById("endpointSelect").value*2+1]);
										
									if(Array.isArray(currentClusterData.endpointsComment[lang])){
										document.getElementById("endpointSelect").parentElement.nextElementSibling.innerHTML = currentClusterData.endpointsComment[document.getElementById("endpointSelect").value][lang]
									}
								}
								
							}
						}
						
						
						input.onchange = function(){
							switch (this.name){
								case "Slot number":
									if (slotAvailable.includes(Number(this.value))){
										slotAvailable.splice(slotAvailable.indexOf(Number(this.value)),1);
										slotAvailable.push(allThreshold[(this.id).split("_")[1]][this.name]);
										allThreshold[(this.id).split("_")[1]][this.name] = Number(this.value);
									} else{
										this.value = allThreshold[(this.id).split("_")[1]][this.name];
									}
									break;
								default:
									allThreshold[(this.id).split("_")[1]][this.name] = Number(this.value);
									break;
							}
						};
						
						
						
						// Je n'arrive pas à juste ajouter du texte à cote de l'input donc je viens creer un element html où j'insère le input et un div
						var inputTout = document.createElement("p");
						inputTout.appendChild(input);
						inputTout.appendChild(inputText);
						
						row.insertCell(1).appendChild(inputTout);
						row.insertCell(2).innerHTML = langData[propertyName+"Com"][lang];
						break;
					
					
					case 'object':
						if(Array.isArray(allThreshold[j][property])){
							var row = body.insertRow(-1);
							row.id = "row_" +property+"_"+j;
							row.insertCell(0).innerHTML= langData[propertyName][lang];
							var selection = document.createElement('select');
							selection.id = property+"_"+j;
							selection.name = property;		
							for(Option in allThreshold[j][property]){
								var option = document.createElement("option");
								option.text = allThreshold[j][property][Option];
								selection.add(option);
							}
							
							selection.onchange = function(){
								switch(this.name){
									case 'Source':
										allThreshold[(this.id).split("_")[1]]["selectedSource"] = this.selectedOptions[0].index;
										
										//On modifie le currentSubparameter pour update les mantisses
										var lastFieldIndex = allThreshold[(this.id).split("_")[1]]["selectedSource"];
										currentCommandParameters[4].subParameters.some(function(element){
											if(element.ParameterID === fieldIndexName[lastFieldIndex]){
												currentSubparameter=element;
												currentMultiplier=currentSubparameter.multiplier;
											}
										});
										document.getElementById("Value_"+(this.id).split("_")[1]).step = 1/currentSubparameter.mantissa;
										document.getElementById("Gap_"+(this.id).split("_")[1]).step = 1/currentSubparameter.mantissa;
										
										document.getElementById("Value_"+(this.id).split("_")[1]).max = Number((fieldRange[this.selectedOptions[0].index].split("=")[1]).split(",")[1]);
										document.getElementById("Gap_"+(this.id).split("_")[1]).max = Number((fieldRange[this.selectedOptions[0].index].split("=")[1]).split(",")[1]);
										
										document.getElementById("text_Value_"+(this.id).split("_")[1]).textContent = (fieldUnit[this.selectedOptions[0].index].split("=")[1]).split(",")[lang];
										document.getElementById("text_Gap_"+(this.id).split("_")[1]).textContent = (fieldUnit[this.selectedOptions[0].index].split("=")[1]).split(",")[lang];
										
										break;
									case 'Mode':
										if (this.selectedOptions[0].value === "Delta"){
											document.getElementById("row_Gap"+"_"+(this.id).split("_")[1]).setAttribute("style","display:none;");
											allThreshold[(this.id).split("_")[1]]["Gap"] = -1;
											
											document.getElementById("row_Occurences"+"_"+(this.id).split("_")[1]).setAttribute("style","display:none;");
											allThreshold[(this.id).split("_")[1]]["Occurences"] = -1;
											
											
											allThreshold[(this.id).split("_")[1]]["selectedMode"] = this.selectedOptions[0].index;
											
											document.getElementById("row_On exceed_"+(this.id).split("_")[1]).setAttribute('style','display:none;');
											document.getElementById("row_On fall_"+(this.id).split("_")[1]).setAttribute('style','display:none;');
											allThreshold[(this.id).split("_")[1]]["On exceed"] = true;
											allThreshold[(this.id).split("_")[1]]["On fall"] = false;
										}else{
											document.getElementById("row_Gap"+"_"+(this.id).split("_")[1]).setAttribute("style","display:run-in;");
											if(Number(document.getElementById("Gap"+"_"+(this.id).split("_")[1]).value) === -1) document.getElementById("Gap"+"_"+(this.id).split("_")[1]).value = 0;
											allThreshold[(this.id).split("_")[1]]["Gap"] = Number(document.getElementById("Gap"+"_"+(this.id).split("_")[1]).value);


											document.getElementById("row_Occurences"+"_"+(this.id).split("_")[1]).setAttribute("style","display:run-in;");
											if(Number(document.getElementById("Occurences"+"_"+(this.id).split("_")[1]).value) === -1) document.getElementById("Occurences"+"_"+(this.id).split("_")[1]).value = 1;
											allThreshold[(this.id).split("_")[1]]["Occurences"] = Number(document.getElementById("Occurences"+"_"+(this.id).split("_")[1]).value);
											
											document.getElementById("row_On exceed_"+(this.id).split("_")[1]).setAttribute('style','display:run-in;');
											document.getElementById("row_On fall_"+(this.id).split("_")[1]).setAttribute('style','display:run-in;');
											
											allThreshold[(this.id).split("_")[1]]["On exceed"] = document.getElementById("On exceed_"+(this.id).split("_")[1]).checked;
											allThreshold[(this.id).split("_")[1]]["On fall"] = document.getElementById("On fall_"+(this.id).split("_")[1]).checked;
											
											
											allThreshold[(this.id).split("_")[1]]["selectedMode"] = this.selectedOptions[0].index;
											
											
										}
									default:
										document.getElementById("Value_"+(this.id).split("_")[1]).min = Number(fieldRange[0].split("=")[1].split(",")[document.getElementById("endpointSelect").value*2]);
										document.getElementById("Value_"+(this.id).split("_")[1]).max = Number(fieldRange[0].split("=")[1].split(",")[document.getElementById("endpointSelect").value*2+1]);
										document.getElementById("Gap_"+(this.id).split("_")[1]).min = Number(fieldRange[0].split("=")[1].split(",")[document.getElementById("endpointSelect").value*2]);
										document.getElementById("Gap_"+(this.id).split("_")[1]).max = Number(fieldRange[0].split("=")[1].split(",")[document.getElementById("endpointSelect").value*2+1]);
										break;
								}
							};
							selection.selectedIndex = allThreshold[j]["selected"+property];
							row.insertCell(1).appendChild(selection);
							row.insertCell(2).innerHTML = langData[propertyName+"Com"][lang];
							
						} else{
						
						}
						break;
					
					
					case 'boolean':
						var row = body.insertRow(-1);
						row.id = "row_" +property+"_"+j;
						row.insertCell(0).innerHTML= langData[propertyName][lang];
						var Checkbox = document.createElement('input'); 
						Checkbox.type = "checkbox";
						Checkbox.id = property+"_"+j;
						Checkbox.name = property;
						Checkbox.checked =allThreshold[j][property];
						Checkbox.onclick = function(){
							allThreshold[(this.id).split("_")[1]][this.name] = this.checked;
						};
						row.insertCell(1).appendChild(Checkbox);
						row.insertCell(2).innerHTML = langData[propertyName+"Com"][lang];
						break;
				}
			}
			
		}
			document.getElementById("Occurences_"+j).step = 1;
			document.getElementById("Slot number_"+j).step = 1;
			document.getElementById("text_Occurences_"+j).textContent = "";
			document.getElementById("text_Slot number_"+j).textContent = "";
			document.getElementById("Mode_"+j).onchange();
			if(document.getElementById("Source_"+j) != null) document.getElementById("Source_"+j).onchange();
			// Séparateur entre les différents slot
			var separateRow = body.insertRow(-1);
			separateRow.setAttribute("style","display:" + dynamicButtonCase[j]+";");
			separateRow.insertCell(0).style.backgroundColor = "#ffe3c4";
			separateRow.insertCell(1).style.backgroundColor = "#ffe3c4";
			
			separateRowCell2 = separateRow.insertCell(2);
			
			var dynamicButton = document.createElement("button");
			dynamicButton.innerText = langData.add[lang];
			dynamicButton.id = j;
			dynamicButton.onclick = function(){
				if(this.innerText === langData.add[lang]){
					dynamicButton.onchange();
					addAThresh(body);
				}else{
					deleteAThresh(body,Number(this.id));
				}
			}
			dynamicButton.onchange = function(){
				var b = 'none';
				dynamicButtonCase[this.id] = b;
			}
			separateRowCell2.appendChild(dynamicButton);
			separateRowCell2.style.backgroundColor = "#ffe3c4"; 
			allThreshold[j]["Occurences"] = Number(document.getElementById("Occurences_"+j).value);
	}
}

function addAThresh (body){
	var Threshold = {
		"Slot number": Math.min(...slotAvailable),
		"Source":null,
		"Mode": ["Threshold","Delta"],
		"Alarm": false,
		"On exceed": false,
		"On fall": false,
		"Occurences": 1,
		"Value": 0,
		"Gap": 0

	};
	if (thresholdSlotAvailable > allThreshold.length){
		var a = JSON.parse(JSON.stringify(Threshold));
		allThreshold.push(a);
		slotAvailable.splice(slotAvailable.indexOf(Math.min(...slotAvailable)),1);
		var b = 'run-in;';
		dynamicButtonCase.push(b);
		while(body.rows[body.rows.length-1].id != 'stopHere'){
			body.deleteRow(-1);
		}
		setThresh(body);
		fromIhmToJson();
	}else{
		alert("you can only have "+thresholdSlotAvailable+" slots.");
	}
	
}

function deleteAThresh (body,i){	
	slotAvailable.push(allThreshold[i]["Slot number"]);
	
	dynamicButtonCase.splice(dynamicButtonCase.length-1,1);
	dynamicButtonCase[dynamicButtonCase.length-1] = 'run-in'
	
	allThreshold.splice(i,1);
	obj.splice(i,1);
	if(allThreshold.length === 0){
		document.getElementById('firstAddButton').disabled = false;
	}
	while(body.rows[body.rows.length-1].id != 'stopHere'){
		body.deleteRow(-1);
	}
	setThresh(body);
	if (allThreshold.length == 0){
		alert(langData.warningSlot[lang]);
	}
}

function setThreshObj(){
  threshObj = 
			{
			"CriteriaSlotDescriptor": 
			
									{ 
									"Alarm": "No", 
									"OnExceed": "No", 
									"OnFall": "No", 
									"Mode": "Threshold", 
									"CriterionIndex": 0
									}, 
			"Value": 0, 
			"Gap": 0, 
			"Occurence": {"ExtendedOccurences": "No", "Occurences": 1 } 
			}
}




function fromIhmToJson(){
	for(var i=0;i<allThreshold.length;i++){
		obj[i] = JSON.parse(JSON.stringify(threshObj));
		for(property in allThreshold[i]){
			switch (property){
				case "Slot number" :
					obj[i]["CriteriaSlotDescriptor"]["CriterionIndex"] = Number(allThreshold[i][property]);
					break;
				case "Source":
					break;
				case "selectedSource":
					if (currentAttributeType === 'ByteString'){
						obj[i]["FieldIndex"] = fieldIndex[Number(allThreshold[i][property])];
					}
					break;
				case "Mode":
					break;
				case "selectedMode":
					obj[i]["CriteriaSlotDescriptor"]["Mode"] = document.getElementById("Mode_"+i)[allThreshold[i][property]].value;
					break;
				case "Alarm":
					obj[i]["CriteriaSlotDescriptor"]["Alarm"] = (allThreshold[i][property]   ? "Yes": "No");
					break;
				case "On exceed":
					obj[i]["CriteriaSlotDescriptor"]["OnExceed"] = (allThreshold[i][property]   ? "Yes": "No");
					break;	
				case "On fall":
					obj[i]["CriteriaSlotDescriptor"]["OnFall"] = (allThreshold[i][property]   ? "Yes": "No");
					break;	
				case "Occurences":
					if (allThreshold[i][property] === -1){
						delete obj[i]["Occurence"];
					}else{
						obj[i]["Occurence"]["Occurences"] = Number(allThreshold[i][property]);
					}
					break;
				case "Gap":
					if (allThreshold[i][property] === -1){
						delete obj[i]["Gap"];
					}else{
						obj[i]["Gap"] = Math.round(currentMultiplier*Number(allThreshold[i][property])*100)/100;
					}
					
					break;
				case "Value":
					obj[i]["Value"] = Math.round(currentMultiplier*Number(allThreshold[i][property])*100)/100;
					break;
			}
		}
	}
}

function beautify(STR){
	var strList = (STR.toLowerCase()).split('');
	var indices = [];
	var el = ' ';
	var idx = STR.indexOf(el);
	while (idx != -1) {
		indices.push(idx);
		idx = STR.indexOf(el, idx + 1);
	}
	
	for (element in indices){
		strList[indices[element]+1]=strList[indices[element]+1].toUpperCase();
	}

	str=strList.toString();
	str=str.replace(/[ \\*-]/g,"");
	str=str.replace(/[,\\*-]/g,"");
	return str;
}


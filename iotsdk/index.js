const IoTClient = require('./client');
const { ThingManager } = require('./thing');
const { ProductManager } = require('./product');
const { DeviceManager } = require('./device');
const { AlarmManager } = require('./alarm');
const utils = require('./utils');

function createClient(config) {
	return new IoTClient(config);
}

function createThingManager(client) {
	return new ThingManager(client);
}

function createProductManager(client) {
	return new ProductManager(client);
}

function createDeviceManager(client) {
	return new DeviceManager(client);
}

function createAlarmManager(client) {
	return new AlarmManager(client);
}

module.exports = {
	IoTClient,
	ThingManager,
	ProductManager,
	DeviceManager,
	AlarmManager,
	createClient,
	createThingManager,
	createProductManager,
	createDeviceManager,
	createAlarmManager,
	utils,
};

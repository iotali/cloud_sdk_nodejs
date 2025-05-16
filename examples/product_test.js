const { ProductManager } = require('../iotsdk/product');
const IoTClient = require('../iotsdk/client');

// 初始化客户端
const client = new IoTClient({
	baseUrl: 'http://127.0.0.1:18083',
	token: '488820fb-41af-40e5-b2d3-d45a8c576eea',
});
const productManager = new ProductManager(client);

async function main() {
	try {
		// 创建产品示例
		// const createResult = await productManager.createProduct({
		// 	productName: '智能温控器',
		// 	productKey: 'THERMO_V2',
		// 	authType: 'Default',
		// 	productSecret: '',
		// });

		// 查询产品详情
		const detail = await productManager.getDetail({
			productKey: 'THERMO_V2',
		});

		// 查询产品列表
		const list = await productManager.list({
			productName: '智能',
			page: 1,
			pageSize: 10,
		});

		// 删除产品示例
		// await productManager.delete({
		// 	productKey: 'THERMO_V2',
		// });
	} catch (error) {
		console.error('测试流程异常:', error.message);
		process.exit(1);
	}
}

if (require.main === module) {
	main().catch((e) => {
		console.error('测试流程失败:', e);
		process.exit(1);
	});
}

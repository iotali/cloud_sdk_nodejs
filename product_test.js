const axios = require('axios');
const { format } = require('date-fns');

/**
 * 创建产品
 * @param {string} baseUrl - API基础URL
 * @param {string} token - 认证令牌
 * @param {string} productName - 产品名称
 * @param {string} productKey - 产品密钥
 * @param {string} authType - 认证类型
 * @param {string} productSecret - 产品密钥
 * @returns {Promise<Object>} API响应结果
 */
async function createProduct(
	baseUrl,
	token,
	productName,
	productKey,
	authType,
	productSecret
) {
	const endpoint = `${baseUrl}/api/v1/product/create`;
	const payload = {
		productName,
		productKey,
		authType,
		productSecret,
	};

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 产品创建成功!');
			const productInfo = response.data.data;
			console.log(`产品名称: ${productInfo.productName}`);
			console.log(`产品Key: ${productInfo.productKey}`);
			console.log(`产品密钥: ${productInfo.productSecret}`);
		} else {
			console.log('\n❌ 产品创建失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}

/**
 * 查询产品详细信息
 * @param {string} baseUrl - API基础URL
 * @param {string} token - 认证令牌
 * @param {string} productId - 产品ID（可选）
 * @param {string} productKey - 产品密钥（可选）
 * @returns {Promise<Object>} API响应结果
 */
async function getProductDetail(baseUrl, token, productId, productKey) {
	if (!productId && !productKey) {
		throw new Error('产品ID(productId)或产品密钥(productKey)至少需要提供一个');
	}

	const endpoint = `${baseUrl}/api/v1/product/query`;
	const payload = productId ? { productId } : { productKey };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 产品详情查询成功!');
			const productInfo = response.data.data;
			console.log(`产品名称: ${productInfo.productName}`);
		} else {
			console.log('\n❌ ���品详情查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}

/**
 * 删除产品
 * @param {string} baseUrl - API基础URL
 * @param {string} token - 认证令牌
 * @param {string} productKey - 产品Key
 * @param {string} productId - 产品ID（可选）
 * @returns {Promise<Object>} API响应结果
 */
async function deleteProduct(baseUrl, token, productId, productKey) {
	if (!productId && !productKey) {
		throw new Error('产品ID(productId)或产品密钥(productKey)至少需要提供一个');
	}

	const endpoint = `${baseUrl}/api/v1/product/delete`;
	const payload = productId ? { productId } : { productKey };

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 产品删除成功!');
			console.log(`删除的产品: ${payload.productId || payload.productKey}`);
		} else {
			console.log('\n❌ 产品删除失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}

/**
 * 查询产品列表
 * @param {string} baseUrl - API基础URL
 * @param {string} token - 认证令牌
 * @param {string} productName - 产品名称（可选，模糊查询）
 * @returns {Promise<Object>} API响应结果
 */
async function queryProductList(baseUrl, token, productName) {
	const endpoint = `${baseUrl}/api/v1/product/queryListAll`;
	const payload = {
		productName: productName || '',
	};

	const headers = {
		'Content-Type': 'application/json',
		token: token,
	};

	try {
		const response = await axios.post(endpoint, payload, { headers });
		console.log('状态码:', response.status);
		// console.log('API响应:\n', JSON.stringify(response.data, null, 2));

		if (response.status == 200) {
			console.log('\n✅ 产品列表查询成功!');
			const productList = response.data.data;
			console.log(`共找到${productList.length}条记录:`);
			productList.forEach((product, index) => {
				console.log(
					`第${index + 1}条 - 产品名称: ${product.productName},  产品Key: ${
						product.productKey
					}`
				);
			});
		} else {
			console.log('\n❌ 产品列表查询失败!');
			console.log('错误信息:', response.data.errorMessage || '未知错误');
		}

		return response.data;
	} catch (error) {
		console.error('请求发生错误:', error.message);
		return null;
	}
}

// 使用示例
if (require.main === module) {
	const baseUrl = 'http://121.40.253.224:10081';
	const token = '488820fb-41af-40e5-b2d3-d45a8c576eea';

	// console.log('\n创建产品示例:');
	// createProduct(baseUrl, token, '测试产品', null, null, null);

	console.log('\n查询产品详情示例:');
	getProductDetail(baseUrl, token, null, 'XWTJwJwO');

	queryProductList(baseUrl, token, null);

	// console.log('\n删除产品示例:');
	// deleteProduct(baseUrl, token, '1922214839204184064', null);
}

import { createApiClient, getApiBaseUrl, getRootFolderPath } from './axiosConfig';

/**
 * Fetch folder content from backend API with AbortSignal support
 * Endpoint: /folder (root) or /folder?path=<path>
 */
export const fetchFolderContents = async (folderPath = '', queryOptions = {}, signal = null) => {
  const client = createApiClient();
  const rootFolderPath = getRootFolderPath();
  
  try {
    const params = {
      root_path: rootFolderPath,
      ...queryOptions,
    };
    if (folderPath && folderPath.trim() !== '') {
      params.path = folderPath;
    }

    const response = await client.get('/folder', { 
      params,
      signal // Supports AbortController to cancel pending requests on path change
    });
    
    const resData = response.data;

    let dataContainer = resData;
    if (resData && typeof resData === 'object' && 'data' in resData) {
      dataContainer = resData.data;
    }

    // Always create fresh arrays to prevent memory references leaks
    const folders = Array.isArray(dataContainer?.folders) ? [...dataContainer.folders] : [];
    const rawPictures = Array.isArray(dataContainer?.pictures) ? [...dataContainer.pictures] : [];
    const rawVideos = Array.isArray(dataContainer?.videos) ? [...dataContainer.videos] : [];

    const totalFolders = dataContainer?.total_folders ?? folders.length;
    const totalPictures = dataContainer?.total_pictures ?? rawPictures.length;
    const totalVideos = dataContainer?.total_videos ?? rawVideos.length;

    const baseUrl = getApiBaseUrl();
    const rootQuery = rootFolderPath ? `?root_path=${encodeURIComponent(rootFolderPath)}` : '';
    const pictures = rawPictures.map((pic) => {
      const cleanPath = pic.path?.startsWith('/') ? pic.path.slice(1) : (pic.path || '');
      const encodedPath = cleanPath.split('/').map(p => encodeURIComponent(p).replace(/#/g, '%2523')).join('/');
      return {
        ...pic,
        url: `${baseUrl}/pictures/${encodedPath}${rootQuery}`,
        thumbnail_url: `${baseUrl}/thumbnails/${encodedPath}${rootQuery}`,
      };
    });

    const videos = rawVideos.map((v) => {
      const cleanPath = v.path?.startsWith('/') ? v.path.slice(1) : (v.path || '');
      const encodedPath = cleanPath.split('/').map(p => encodeURIComponent(p).replace(/#/g, '%2523')).join('/');
      return {
        ...v,
        url: `${baseUrl}/videos/${encodedPath}${rootQuery}`,
      };
    });

    return {
      success: true,
      status: resData?.status || response.status || 200,
      message: resData?.message || 'Lấy dữ liệu thành công',
      data: {
        folders,
        pictures,
        videos,
        totalFolders,
        totalPictures,
        totalVideos,
      },
      rawResponse: resData,
    };
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return { canceled: true };
    }

    console.error('Lỗi khi gọi API folder:', error);
    
    let errorMessage = 'Không thể kết nối đến máy chủ API.';
    let errorDetails = null;
    let statusCode = null;
    let requestUrl = `${client.defaults.baseURL}/folder${folderPath ? `?path=${encodeURIComponent(folderPath)}` : ''}`;

    if (error.response) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.message || `Máy chủ phản hồi lỗi (${statusCode})`;
      errorDetails = JSON.stringify(error.response.data, null, 2);
    } else if (error.request) {
      errorMessage = `Không nhận được phản hồi từ server (${requestUrl}). Hãy kiểm tra địa chỉ IP, Cổng hoặc đường dẫn thư mục.`;
    } else {
      errorMessage = error.message;
    }

    return {
      success: false,
      status: statusCode || 500,
      message: errorMessage,
      details: errorDetails,
      url: requestUrl,
      rawError: error,
    };
  }
};

/**
 * Fetch full nested folder tree structure from backend API
 * Endpoint: /tree-folder
 */
export const fetchFolderTree = async (signal = null) => {
  const client = createApiClient();
  const rootFolderPath = getRootFolderPath();
  try {
    const response = await client.get('/tree-folder', { 
      params: { root_path: rootFolderPath },
      signal 
    });
    const resData = response.data;
    
    let treeArray = [];
    if (resData && typeof resData === 'object' && 'data' in resData) {
      treeArray = Array.isArray(resData.data) ? resData.data : [];
    } else if (Array.isArray(resData)) {
      treeArray = resData;
    }

    return {
      success: true,
      data: treeArray,
    };
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return { canceled: true };
    }
    console.error('Lỗi khi gọi API /tree-folder:', error);
    return {
      success: false,
      data: [],
    };
  }
};

/**
 * Create a new subfolder in the target parent path
 * Endpoint: POST /folder
 */
export const createNewFolder = async (parentPath = '', folderName = '') => {
  const client = createApiClient();
  const rootFolderPath = getRootFolderPath();
  try {
    const response = await client.post('/folder', {
      path: parentPath,
      name: folderName,
    }, {
      params: {
        root_path: rootFolderPath,
      }
    });

    const resData = response.data;
    return {
      success: true,
      message: resData?.message || 'Tạo thư mục mới thành công',
      data: resData?.data,
    };
  } catch (error) {
    console.error('Lỗi khi tạo thư mục:', error);
    let message = 'Không thể tạo thư mục mới.';
    if (error.response?.data?.message) {
      message = error.response.data.message;
    }
    return {
      success: false,
      message,
    };
  }
};

/**
 * Rename an existing folder
 * Endpoint: PUT /folder/rename
 */
export const renameFolder = async (folderPath, newName) => {
  const client = createApiClient();
  const rootFolderPath = getRootFolderPath();
  try {
    const response = await client.put('/folder/rename', {
      path: folderPath,
      new_name: newName,
    }, {
      params: {
        root_path: rootFolderPath,
      }
    });

    const resData = response.data;
    return {
      success: true,
      message: resData?.message || 'Đổi tên thư mục thành công',
      data: resData?.data,
    };
  } catch (error) {
    console.error('Lỗi khi đổi tên thư mục:', error);
    let message = 'Không thể đổi tên thư mục.';
    if (error.response?.data?.message) {
      message = error.response.data.message;
    }
    return {
      success: false,
      message,
    };
  }
};

/**
 * Move a file or folder to a target destination folder
 * Endpoint: POST /item/move
 */
export const moveItem = async (srcPath, destFolderPath) => {
  const client = createApiClient();
  const rootFolderPath = getRootFolderPath();
  try {
    const response = await client.post('/item/move', {
      src_path: srcPath,
      dest_folder_path: destFolderPath,
    }, {
      params: {
        root_path: rootFolderPath,
      }
    });

    const resData = response.data;
    return {
      success: true,
      message: resData?.message || 'Di chuyển thành công',
      data: resData?.data,
    };
  } catch (error) {
    console.error('Lỗi khi di chuyển:', error);
    let message = 'Không thể di chuyển đối tượng.';
    if (error.response?.data?.message) {
      message = error.response.data.message;
    }
    return {
      success: false,
      message,
    };
  }
};

/**
 * Delete a folder
 * Endpoint: DELETE /folder
 */
export const deleteFolder = async (folderPath) => {
  const client = createApiClient();
  const rootFolderPath = getRootFolderPath();
  try {
    const response = await client.delete('/folder', {
      params: {
        path: folderPath,
        root_path: rootFolderPath,
      }
    });

    const resData = response.data;
    return {
      success: true,
      message: resData?.message || 'Xóa thư mục thành công',
    };
  } catch (error) {
    console.error('Lỗi khi xóa thư mục:', error);
    let message = 'Không thể xóa thư mục.';
    if (error.response?.data?.message || error.response?.data?.error) {
      message = error.response?.data?.message || error.response?.data?.error;
    }
    return {
      success: false,
      message,
    };
  }
};

/**
 * Delete a file (image or video)
 * Endpoint: DELETE /file
 */
export const deleteFile = async (filePath) => {
  const client = createApiClient();
  const rootFolderPath = getRootFolderPath();
  try {
    const response = await client.delete('/file', {
      params: {
        path: filePath,
        root_path: rootFolderPath,
      }
    });

    const resData = response.data;
    return {
      success: true,
      message: resData?.message || 'Xóa tệp thành công',
    };
  } catch (error) {
    console.error('Lỗi khi xóa tệp:', error);
    let message = 'Không thể xóa tệp.';
    if (error.response?.data?.message || error.response?.data?.error) {
      message = error.response?.data?.message || error.response?.data?.error;
    }
    return {
      success: false,
      message,
    };
  }
};


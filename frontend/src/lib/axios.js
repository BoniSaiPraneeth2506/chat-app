import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: "https://chat-app-backend-zg2t.onrender.com/api",
    withCredentials: true
});

export default axiosInstance;

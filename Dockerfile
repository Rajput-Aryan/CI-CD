# Use lightweight Nginx Alpine base image
FROM nginx:1.27-alpine

# Set working directory inside container
WORKDIR /usr/share/nginx/html

# Remove default Nginx static files
RUN rm -rf ./*

# Copy static portfolio website files into Nginx default directory
COPY ["personal profile/", "/usr/share/nginx/html/"]

# Expose port 80 for HTTP traffic
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]

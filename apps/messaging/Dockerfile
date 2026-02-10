# syntax=docker/dockerfile:1
FROM ruby:3.4.4-slim AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    git \
    libpq-dev \
    libyaml-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install bundler
RUN gem install bundler -v '~> 2.5'

# Copy Gemfile and lockfile
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle install --jobs 4 --retry 3

# Copy application code
COPY . .

# Precompile bootsnap code for faster boot times
RUN bundle exec bootsnap precompile --gemfile app/ lib/

# Expose port
EXPOSE 3001

# Default command
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3001"]

# Development stage
FROM base AS development
ENV RAILS_ENV=development
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3001"]

# Production stage
FROM base AS production
ENV RAILS_ENV=production
ENV RAILS_LOG_TO_STDOUT=true
ENV RAILS_SERVE_STATIC_FILES=true
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "3001"]
